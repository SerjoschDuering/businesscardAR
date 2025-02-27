document.addEventListener('DOMContentLoaded', () => {
    // Global variable to keep track of the model’s last known world position.
    let lastGlobalPos = new THREE.Vector3();
    // Smoothing factor for continuous mode (lower values yield more smoothing).
    const smoothingFactor = 0.2;
    // Set anchoring mode to "continuous" so the cube follows the marker.
    const anchoringMode = "continuous"; 
  
    // Helper function to reparent an A-Frame entity while preserving its world transform.
    // This is used when detaching the model from the marker.
    function reparentPreservingWorldTransform(childEl, newParentEl) {
      // Update matrixWorld of the child.
      childEl.object3D.updateMatrixWorld(true);
      // Clone the world transformation matrix.
      const worldMatrix = childEl.object3D.matrixWorld.clone();
    
      // Reparent using Three.js' attach method:
      newParentEl.object3D.attach(childEl.object3D);
    
      // Copy the world matrix into the child's matrix and decompose it.
      childEl.object3D.matrix.copy(worldMatrix);
      childEl.object3D.matrix.decompose(
        childEl.object3D.position,
        childEl.object3D.quaternion,
        childEl.object3D.scale
      );
    }
    
    // Helper function: AR.js may apply the marker transform to a child group.
    // This function returns the marker’s world position from the proper object.
    function getMarkerWorldPosition(markerEl) {
      let pos = new THREE.Vector3();
      if (markerEl.object3D.children.length > 0) {
        markerEl.object3D.children[0].getWorldPosition(pos);
      } else {
        markerEl.object3D.getWorldPosition(pos);
      }
      return pos;
    }
    
    // Log when the A-Frame scene is loaded.
    const sceneEl = document.querySelector('a-scene');
    if (sceneEl) {
      sceneEl.addEventListener('loaded', () => {
        console.log('A-Frame scene loaded!');
      });
    }
    
    // Get the model entity (or the cube) to be anchored.
    const modelEntity = document.getElementById('model-container');
    
    // Get the marker element.
    const markerEl = document.getElementById('marker');
    if (markerEl) {
      markerEl.addEventListener('markerFound', () => {
        // Get the marker’s true position.
        let targetPos = getMarkerWorldPosition(markerEl);
        // Initialize the global position.
        lastGlobalPos.copy(targetPos);
        console.log("Marker found! Position:", targetPos);
    
        // In continuous mode, ensure the model entity is attached to the marker.
        if (anchoringMode === "continuous") {
          if (modelEntity.parentNode !== markerEl) {
            markerEl.appendChild(modelEntity);
            // Reset the model’s local position so that it is aligned.
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
        // Detach from the marker, preserving the world transform.
        reparentPreservingWorldTransform(modelEntity, sceneEl);
      });
    
      // In continuous mode, periodically update the global coordinate if the marker is visible.
      if (anchoringMode === "continuous") {
        setInterval(() => {
          // Even if markerEl.object3D.visible is false,
          // try to get the position from its child transformation.
          let targetPos = getMarkerWorldPosition(markerEl);
          lastGlobalPos.lerp(targetPos, smoothingFactor);
          console.log(
            `Continuous update: smoothed position: x=${lastGlobalPos.x.toFixed(2)}, y=${lastGlobalPos.y.toFixed(2)}, z=${lastGlobalPos.z.toFixed(2)}`
          );
        }, 500);
      }
    
      // Optional: Periodically log the marker's (local) transformation.
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
    
    // [The fetching model code remains unchanged below...]
    // Extract the "id" parameter from the URL.
    const params = new URLSearchParams(window.location.search);
    const modelId = params.get('id');
    if (!modelId) {
      console.error("No model ID provided in the URL.");
      return;
    }
    console.log("Extracted model ID:", modelId);
    
    // Define your n8n endpoint.
    const endpoint = 'https://run8n.xyz/webhook-test/getGLTF';
    console.log("Fetching models from endpoint:", endpoint);
    
    // Create an AbortController with a timeout.
    const controller = new AbortController();
    const timeoutMs = 15000;
    const timeoutID = setTimeout(() => {
      console.error(`Fetch request timed out after ${timeoutMs}ms`);
      controller.abort();
    }, timeoutMs);
    
    // Fetch model data via POST.
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
    
        // If multiple models are available, cycle through them.
        if (modelUrls.length > 1) {
          let currentIndex = 0;
          console.log("Multiple models detected. Cycling every 5 seconds.");
          setInterval(() => {
            currentIndex = (currentIndex + 1) % modelUrls.length;
            console.log("Switching to model URL:", modelUrls[currentIndex]);
            modelEntity.setAttribute('gltf-model', modelUrls[currentIndex]);
          }, 5000);
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