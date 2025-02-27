document.addEventListener('DOMContentLoaded', () => {
    // Get our elements from the scene.
    const dummyBox = document.getElementById('dummy-box');
    const markerEl = document.getElementById('marker');
    const sceneEl = document.querySelector('a-scene');
  
    // When the marker is found, attach the dummy box (red cube) so that it follows the marker.
    markerEl.addEventListener('markerFound', () => {
      if (dummyBox.parentNode !== markerEl) {
        markerEl.appendChild(dummyBox);
        // Reset its local position relative to the marker.
        dummyBox.setAttribute('position', '0 0 0');
      }
    });
  
    // When the marker is lost, detach the dummy box so it remains fixed in the scene.
    markerEl.addEventListener('markerLost', () => {
      sceneEl.appendChild(dummyBox);
    });
  
    // Global variable for tracking the model’s last known world position.
    let lastGlobalPos = new THREE.Vector3();
    // Smoothing factor for continuous mode.
    const smoothingFactor = 0.2;
    // Set anchoring mode to continuous.
    const anchoringMode = "continuous";
  
    // Helper function to reparent an A-Frame entity while preserving its world transform.
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
  
    // Helper function: attempts to return the marker’s world position.
    function getMarkerWorldPosition(markerEl) {
      let pos = new THREE.Vector3();
      if (markerEl.object3D.children.length > 0) {
        markerEl.object3D.children[0].getWorldPosition(pos);
      } else {
        markerEl.object3D.getWorldPosition(pos);
      }
      return pos;
    }
  
    // Log that the A-Frame scene is loaded.
    if (sceneEl) {
      sceneEl.addEventListener('loaded', () => {
        console.log('A-Frame scene loaded!');
      });
    }
  
    // Get the model entity (the fetched model will be attached here).
    const modelEntity = document.getElementById('model-container');
  
    // Marker event listeners for the model entity.
    if (markerEl) {
      markerEl.addEventListener('markerFound', () => {
        // Get the marker’s true position.
        let targetPos = getMarkerWorldPosition(markerEl);
        lastGlobalPos.copy(targetPos);
        console.log("Marker found! Position:", targetPos);
  
        // In continuous mode, attach to the marker.
        if (anchoringMode === "continuous") {
          if (modelEntity.parentNode !== markerEl) {
            markerEl.appendChild(modelEntity);
            // Reset local position relative to the marker.
            modelEntity.setAttribute('position', "0 0 0");
          }
        }
        modelEntity.setAttribute('visible', true);
      });
  
      markerEl.addEventListener('markerLost', () => {
        console.log('Marker lost!');
        // Update one last time before detaching.
        let targetPos = getMarkerWorldPosition(markerEl);
        lastGlobalPos.lerp(targetPos, smoothingFactor);
        console.log("Final smoothed position on markerLost:", lastGlobalPos);
        // Detach from the marker while preserving world transform.
        reparentPreservingWorldTransform(modelEntity, sceneEl);
      });
  
      // Continuous updates for the marker (for smoothing, etc.).
      if (anchoringMode === "continuous") {
        setInterval(() => {
          let targetPos = getMarkerWorldPosition(markerEl);
          lastGlobalPos.lerp(targetPos, smoothingFactor);
          console.log(
            `Continuous update: smoothed position: x=${lastGlobalPos.x.toFixed(2)}, y=${lastGlobalPos.y.toFixed(2)}, z=${lastGlobalPos.z.toFixed(2)}`
          );
        }, 500);
      }
  
      // Optional: log the marker’s local transformation every 2 seconds.
      if (markerEl.object3D) {
        setInterval(() => {
          const pos = markerEl.object3D.position;
          const rot = markerEl.object3D.rotation;
          console.log(
            `Marker local position: x=${pos.x.toFixed(2)}, y=${pos.y.toFixed(2)}, z=${pos.z.toFixed(2)}; rotation: x=${rot.x.toFixed(2)}, y=${rot.y.toFixed(2)}, z=${rot.z.toFixed(2)}`
          );
        }, 2000);
      }
    } else {
      console.error('Marker element not found!');
    }
  
    // ------------------- Fetching model data via API -------------------
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
  
    // Create an AbortController with a timeout.
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
  
        // Parse each entry's 'data' property (JSON glTF content).
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
  
        // Create Blob URLs from the parsed glTF JSON objects.
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
  
        // Set the initially fetched model.
        console.log("Setting initial model URL:", modelUrls[0]);
        modelEntity.setAttribute('gltf-model', modelUrls[0]);
        // Scale the model 5× smaller.
        modelEntity.setAttribute('scale', '0.01 0.01 0.01');
  
        // If multiple models are available, cycle through them every 10 seconds.
        if (modelUrls.length > 1) {
          let currentIndex = 0;
          console.log("Multiple models detected. Cycling every 10 seconds.");
          setInterval(() => {
            currentIndex = (currentIndex + 1) % modelUrls.length;
            console.log("Switching to model URL:", modelUrls[currentIndex]);
            modelEntity.setAttribute('gltf-model', modelUrls[currentIndex]);
          }, 10000);
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