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
        // Only update if the marker element exists and is visible.
        if (!this.markerEl || !this.markerEl.object3D.visible) {
          return;
        }
        // Ensure the marker's world transform is up to date.
        this.markerEl.object3D.updateMatrixWorld(true);
  
        // Prepare a target vector to hold the marker's current world position.
        let targetPos = new THREE.Vector3();
  
        // Defensive check: some AR.js versions place an "anchor group" as children[0].
        // If no children, we can fallback directly to markerEl.object3D.
        if (this.markerEl.object3D.children && this.markerEl.object3D.children.length > 0) {
          this.markerEl.object3D.children[0].updateMatrixWorld(true);
          this.markerEl.object3D.children[0].getWorldPosition(targetPos);
        } else {
          this.markerEl.object3D.getWorldPosition(targetPos);
        }
  
        // Lerp toward this new position for smoothness.
        this.lastGlobalPos.lerp(targetPos, this.data.smoothingFactor);
  
        // Throttle debug logging to once per second.
        this.elapsed += delta;
        if (this.elapsed > 1000) {
          this.elapsed = 0;
          console.log('Smooth updater position:', this.lastGlobalPos);
        }
  
        // Expose the smoothed value globally for other callbacks.
        window.smoothLastGlobalPos = this.lastGlobalPos.clone();
      }
    });
  
    // ====================== Grab Scene / Marker / Model ======================
    const dummyBox = document.getElementById('dummy-box');
    const markerEl = document.getElementById('marker');
    const sceneEl = document.querySelector('a-scene');
    const modelEntity = document.getElementById('model-container');
  
    // Removed the modelDetached flag since we always want the model attached.
  
    // When the marker is found, attach the dummy box (red cube) so it follows the marker.
    markerEl.addEventListener('markerFound', () => {
      if (dummyBox.parentNode !== markerEl) {
        markerEl.appendChild(dummyBox);
        dummyBox.setAttribute('position', '0 0 0');  // Reset local position
      }
    });
  
    // When the marker is lost, detach the dummy box so it remains in the scene at its last position.
    markerEl.addEventListener('markerLost', () => {
      sceneEl.appendChild(dummyBox);
    });
  
    // Global variable for tracking the model’s last known world position.
    let lastGlobalPos = new THREE.Vector3();
    // Smoothing factor used in marker event callbacks.
    const smoothingFactor = 0.2;
    // We are in "continuous" anchoring mode.
    const anchoringMode = "continuous";
  
    // ====================== Re-parent Helper ======================
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
  
    // ====================== Marker World Position Helper ======================
    function getMarkerWorldPosition(markerEl) {
      let pos = new THREE.Vector3();
      // If AR.js placed an internal anchor in children[0], use that; else fallback to the marker itself.
      if (markerEl.object3D.children && markerEl.object3D.children.length > 0) {
        markerEl.object3D.children[0].updateMatrixWorld(true);
        markerEl.object3D.children[0].getWorldPosition(pos);
      } else {
        markerEl.object3D.getWorldPosition(pos);
      }
      return pos;
    }
  
    // ====================== Scene Loaded Log ======================
    if (sceneEl) {
      sceneEl.addEventListener('loaded', () => {
        console.log('A-Frame scene loaded!');
      });
    }
  
    // ====================== Marker Events for Model Entity ======================
    if (markerEl) {
      markerEl.addEventListener('markerFound', () => {
        let targetPos = getMarkerWorldPosition(markerEl);
        lastGlobalPos.copy(targetPos);
        console.log("Marker found! Position:", targetPos);
  
        // Continuous anchoring: attach the model to the marker on found.
        if (anchoringMode === "continuous") {
          if (modelEntity.parentNode !== markerEl) {
            markerEl.appendChild(modelEntity);
            modelEntity.setAttribute('position', "0 0 0"); // Reset local position
          }
        }
        modelEntity.setAttribute('visible', true);
      });
  
      markerEl.addEventListener('markerLost', () => {
        // Since we always want the model attached to the marker,
        // we do not detach it on marker lost.
        console.log('Marker lost!');
      });
  
      // OPTIONAL: Log the marker’s local transformation every 2 seconds.
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
  
    // ====================== Removed Periodic Reattachment ======================
    // The periodic reattachment code was removed because the model is always attached.
  
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
  
    // Create an AbortController with a timeout to avoid hanging requests.
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
  
        // Create Blob URLs from the glTF JSON
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
  
        // Set the first fetched model on our entity.
        console.log("Setting initial model URL:", modelUrls[0]);
        modelEntity.setAttribute('gltf-model', modelUrls[0]);
        // Scale the model 5× smaller if desired.
        modelEntity.setAttribute('scale', '0.01 0.01 0.01');
  
        // If multiple models, cycle through them every 10 seconds.
        if (modelUrls.length > 1) {
          let currentIndex = 0;
          console.log("Multiple models detected. Cycling every 10 seconds.");
          setInterval(() => {
            currentIndex = (currentIndex + 1) % modelUrls.length;
            console.log("Switching to model URL:", modelUrls[currentIndex]);
            modelEntity.setAttribute('gltf-model', modelUrls[currentIndex]);
          }, 500);
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