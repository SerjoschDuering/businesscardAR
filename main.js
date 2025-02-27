document.addEventListener('DOMContentLoaded', () => {
    // ====================== Smooth-Updater Component ======================
    AFRAME.registerComponent('smooth-updater', {
      schema: {
        smoothingFactor: { type: 'number', default: 0.2 }
      },
      init: function () {
        this.lastGlobalPos = new THREE.Vector3();
        this.markerEl = document.getElementById('marker');
        this.elapsed = 0;
      },
      tick: function (time, delta) {
        if (!this.markerEl || !this.markerEl.object3D.visible) {
          return;
        }
        this.markerEl.object3D.updateMatrixWorld(true);
        let targetPos = new THREE.Vector3();
        if (this.markerEl.object3D.children && this.markerEl.object3D.children.length > 0) {
          this.markerEl.object3D.children[0].updateMatrixWorld(true);
          this.markerEl.object3D.children[0].getWorldPosition(targetPos);
        } else {
          this.markerEl.object3D.getWorldPosition(targetPos);
        }
        this.lastGlobalPos.lerp(targetPos, this.data.smoothingFactor);
        this.elapsed += delta;
        if (this.elapsed > 1000) {
          this.elapsed = 0;
          console.log('Smooth updater position:', this.lastGlobalPos);
        }
        window.smoothLastGlobalPos = this.lastGlobalPos.clone();
      }
    });
    
    // ====================== Grab Scene / Marker / Model ======================
    const dummyBox = document.getElementById('dummy-box');
    const markerEl = document.getElementById('marker');
    const sceneEl = document.querySelector('a-scene');
    // The original model container (always attached to the marker)
    const modelEntity = document.getElementById('model-container');
  
    // Create an inactive model container for crossfade transitions.
    // We copy the same scale/position/rotation from the original one.
    let activeModelEntity = modelEntity;
    let inactiveModelEntity = document.createElement('a-entity');
    inactiveModelEntity.setAttribute('scale', modelEntity.getAttribute('scale'));
    inactiveModelEntity.setAttribute('position', "0 0 0");
    inactiveModelEntity.setAttribute('rotation', modelEntity.getAttribute('rotation'));
    inactiveModelEntity.setAttribute('visible', false);
    inactiveModelEntity.setAttribute('id', 'model-container-inactive');
    // Append it as a sibling inside the marker.
    markerEl.appendChild(inactiveModelEntity);
  
    // When marker is found, attach the dummy box
    markerEl.addEventListener('markerFound', () => {
      if (dummyBox.parentNode !== markerEl) {
        markerEl.appendChild(dummyBox);
        dummyBox.setAttribute('position', '0 0 0');
      }
    });
    
    // When marker is lost, detach the dummy box so it remains in the scene.
    markerEl.addEventListener('markerLost', () => {
      sceneEl.appendChild(dummyBox);
      console.log('Marker lost!');
    });
    
    let lastGlobalPos = new THREE.Vector3();
    const smoothingFactor = 0.2;
    const anchoringMode = "continuous";
    
    function reparentPreservingWorldTransform(childEl, newParentEl) {
      childEl.object3D.updateMatrixWorld(true);
      const worldMatrix = childEl.object3D.matrixWorld.clone();
      newParentEl.object3D.attach(childEl.object3D);
      childEl.object3D.matrix.copy(worldMatrix);
      childEl.object3D.matrix.decompose(
        childEl.object3D.position,
        childEl.object3D.quaternion,
        childEl.object3D.scale
      );
    }
    
    function getMarkerWorldPosition(markerEl) {
      let pos = new THREE.Vector3();
      if (markerEl.object3D.children && markerEl.object3D.children.length > 0) {
        markerEl.object3D.children[0].updateMatrixWorld(true);
        markerEl.object3D.children[0].getWorldPosition(pos);
      } else {
        markerEl.object3D.getWorldPosition(pos);
      }
      return pos;
    }
    
    if (sceneEl) {
      sceneEl.addEventListener('loaded', () => {
        console.log('A-Frame scene loaded!');
      });
    }
    
    if (markerEl) {
      markerEl.addEventListener('markerFound', () => {
        let targetPos = getMarkerWorldPosition(markerEl);
        lastGlobalPos.copy(targetPos);
        console.log("Marker found! Position:", targetPos);
    
        if (anchoringMode === "continuous") {
          if (activeModelEntity.parentNode !== markerEl) {
            markerEl.appendChild(activeModelEntity);
            activeModelEntity.setAttribute('position', "0 0 0");
          }
        }
        activeModelEntity.setAttribute('visible', true);
      });
    
      markerEl.addEventListener('markerLost', () => {
        console.log('Marker lost!');
      });
    
      if (markerEl.object3D) {
        setInterval(() => {
          const pos = markerEl.object3D.position;
          const rot = markerEl.object3D.rotation;
          console.log(
            `Marker local position: x=${pos.x.toFixed(2)}, y=${pos.y.toFixed(2)}, z=${pos.z.toFixed(2)}; ` +
            `rotation: x=${rot.x.toFixed(2)}, y=${rot.y.toFixed(2)}, z=${rot.z.toFixed(2)}`
          );
        }, 2000);
      }
    } else {
      console.error('Marker element not found!');
    }
    
    // -------------------- Helper Functions for Crossfade --------------------
    // Set opacity for all meshes within an entity.
    function setOpacity(entity, opacity) {
      entity.object3D.traverse(child => {
        if (child.isMesh && child.material) {
          child.material.opacity = opacity;
          child.material.needsUpdate = true;
        }
      });
    }
    
    // Enable transparency on all meshes.
    function setTransparent(entity) {
      entity.object3D.traverse(child => {
        if (child.isMesh && child.material) {
          child.material.transparent = true;
          // Ensure opacity is defined.
          if (typeof child.material.opacity === 'undefined') {
            child.material.opacity = 1;
          }
          child.material.needsUpdate = true;
        }
      });
    }
    
    // Crossfade from activeModelEntity to a new model loaded in inactiveModelEntity.
    function crossfadeToModel(newUrl) {
      // Load the new model into the inactive container.
      inactiveModelEntity.setAttribute('gltf-model', newUrl);
      inactiveModelEntity.setAttribute('visible', true);
      // Reset transform attributes as needed.
      inactiveModelEntity.setAttribute('position', "0 0 0");
      inactiveModelEntity.setAttribute('rotation', activeModelEntity.getAttribute('rotation'));
      inactiveModelEntity.setAttribute('scale', activeModelEntity.getAttribute('scale'));
      
      // Wait until the new model is loaded.
      inactiveModelEntity.addEventListener('model-loaded', function handler() {
        inactiveModelEntity.removeEventListener('model-loaded', handler);
        console.log("New model loaded for crossfade transition");
        
        // Ensure that both models support opacity animation.
        setTransparent(inactiveModelEntity);
        setTransparent(activeModelEntity);
        
        // Start with the inactive model fully transparent.
        setOpacity(inactiveModelEntity, 0);
        
        let duration = 100; // duration in milliseconds for the fade
        let startTime = null;
        
        function animateFade(timestamp) {
          if (!startTime) startTime = timestamp;
          let progress = (timestamp - startTime) / duration;
          if (progress > 1) progress = 1;
    
          // Fade in new model (opacity: 0 -> 1) and fade out current (opacity: 1 -> 0)
          setOpacity(inactiveModelEntity, progress);
          setOpacity(activeModelEntity, 1 - progress);
    
          if (progress < 1) {
            requestAnimationFrame(animateFade);
          } else {
            // After fade, hide the old model and swap active and inactive references.
            activeModelEntity.setAttribute('visible', false);
            // Reset opacity back to full for the now-active model.
            setOpacity(inactiveModelEntity, 1);
            // Swap active with inactive for next transition.
            let temp = activeModelEntity;
            activeModelEntity = inactiveModelEntity;
            inactiveModelEntity = temp;
          }
        }
    
        requestAnimationFrame(animateFade);
      });
    }
    
    // ====================== Fetching Model Data via API ======================
    const params = new URLSearchParams(window.location.search);
    const modelId = params.get('id');
    if (!modelId) {
      console.error("No model ID provided in the URL.");
      return;
    }
    console.log("Extracted model ID:", modelId);
    
    // Define the API endpoint.
    const endpoint = 'https://run8n.xyz/webhook-test/getGLTF';
    console.log("Fetching models from endpoint:", endpoint);
    
    // Set up an AbortController to timeout slow fetches.
    const controller = new AbortController();
    const timeoutMs = 15000;
    const timeoutID = setTimeout(() => {
      console.error(`Fetch request timed out after ${timeoutMs}ms`);
      controller.abort();
    }, timeoutMs);
    
    fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ id: modelId }),
      signal: controller.signal
    })
      .then(response => {
        clearTimeout(timeoutID);
        console.log("HTTP response status:", response.status);
        return response.json();
      })
      .then(data => {
        console.log("Raw webhook response data:", data);
    
        // Parse each entry's 'data' (JSON-encoded glTF).
        const parsedModels = data.map((entry, index) => {
          if (!entry.data) {
            console.error(`Entry at index ${index} missing 'data' property.`);
            return null;
          }
          try {
            const parsed = JSON.parse(entry.data);
            console.log(`Parsed model at index ${index}:`, parsed);
            return parsed;
          } catch (error) {
            console.error(`Error parsing JSON for model at index ${index}:`, error);
            return null;
          }
        }).filter(model => model !== null);
    
        if (parsedModels.length === 0) {
          console.error("No valid model JSON found.");
          return;
        }
    
        // Create Blob URLs from the glTF JSON.
        const modelUrls = parsedModels.map((gltf, index) => {
          try {
            const blob = new Blob([JSON.stringify(gltf)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            console.log(`Created blob URL for model index ${index}:`, url);
            return url;
          } catch (error) {
            console.error(`Error creating blob URL for model index ${index}:`, error);
            return null;
          }
        }).filter(url => url !== null);
    
        if (modelUrls.length === 0) {
          console.error("No valid blob URLs generated.");
          return;
        }
    
        // Set the first fetched model on the active model container.
        console.log("Setting initial model URL:", modelUrls[0]);
        activeModelEntity.setAttribute('gltf-model', modelUrls[0]);
        activeModelEntity.setAttribute('visible', true);
        activeModelEntity.setAttribute('position', "0 0 0");
        // Scale the model as needed.
        activeModelEntity.setAttribute('scale', '0.01 0.01 0.01');
    
        // If multiple models are provided, cycle through them every 10 seconds using crossfade.
        if (modelUrls.length > 1) {
          let currentIndex = 0;
          console.log("Multiple models detected. Cycling every 10 seconds with crossfade.");
          setInterval(() => {
            currentIndex = (currentIndex + 1) % modelUrls.length;
            console.log("Crossfading to model URL:", modelUrls[currentIndex]);
            crossfadeToModel(modelUrls[currentIndex]);
          }, 1500);
        }
      })
      .catch(error => {
        if (error.name === 'AbortError') {
          console.error("Fetch request aborted due to timeout.");
        } else {
          console.error("Error fetching models:", error);
        }
      });
  });