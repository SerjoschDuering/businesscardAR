document.addEventListener('DOMContentLoaded', () => {
    // Global variable to keep track of the model's last known world position.
    let lastGlobalPos = new THREE.Vector3();
    // Smoothing factor for continuous mode (lower values yield more smoothing).
    const smoothingFactor = 0.2;
    // Choose between "once" (anchor only once) or "continuous" (follow marker continually).
    const anchoringMode = "once"; 
    let anchored = false; // Tracks whether the model has been anchored in once mode.
  
    // Helper function to reparent an A-Frame entity while preserving its world transform.
    // It uses the underlying Three.js object3D to update the transformation.
    function reparentPreservingWorldTransform(childEl, newParentEl) {
      // Update matrixWorld of the child.
      childEl.object3D.updateMatrixWorld(true);
      // Get the full world transformation matrix.
      const worldMatrix = childEl.object3D.matrixWorld.clone();
  
      // Reparent using the Three.js attach method:
      // This will remove the child from its current parent and add it to newParentEl.object3D.
      newParentEl.object3D.attach(childEl.object3D);
  
      // Copy the worldMatrix into the child, then decompose it to update position, quaternion, scale.
      childEl.object3D.matrix.copy(worldMatrix);
      childEl.object3D.matrix.decompose(
        childEl.object3D.position,
        childEl.object3D.quaternion,
        childEl.object3D.scale
      );
    }
  
    // Log when the A-Frame scene is loaded.
    const sceneEl = document.querySelector('a-scene');
    if (sceneEl) {
      sceneEl.addEventListener('loaded', () => {
        console.log('A-Frame scene loaded!');
      });
    }
  
    // Get the model that was fetched (the AR content).
    const modelEntity = document.getElementById('model-container');
  
    // Attach marker event listeners to decide how to update/reparent the model.
    const markerEl = document.getElementById('marker');
    if (markerEl) {
      markerEl.addEventListener('markerFound', () => {
        console.log('Marker found!');
        // In "once" mode, only anchor if not already anchored.
        if (anchoringMode === "once" && !anchored) {
          // Capture marker's current world position (for logging or further use).
          markerEl.object3D.getWorldPosition(lastGlobalPos);
          console.log("Anchoring model once at:", lastGlobalPos);
  
          // Detach the model from the marker and attach it to the scene.
          // This preserves its world transform so it stays fixed in the world.
          reparentPreservingWorldTransform(modelEntity, sceneEl);
          anchored = true; 
        }
        // In continuous mode, update the model's location every time the marker is detected.
        else if (anchoringMode === "continuous") {
          let targetPos = new THREE.Vector3();
          markerEl.object3D.getWorldPosition(targetPos);
          lastGlobalPos.lerp(targetPos, smoothingFactor);
          console.log("Continuous update, smoothed position:", lastGlobalPos);
          // If the model is not already attached to the marker, reparent it.
          if (modelEntity.parentNode !== markerEl) {
            markerEl.appendChild(modelEntity);
            modelEntity.setAttribute('position', "0 0 0");
          }
        }
        // Ensure the model is visible.
        modelEntity.setAttribute('visible', true);
      });
  
      markerEl.addEventListener('markerLost', () => {
        console.log('Marker lost!');
        if (anchoringMode === "continuous") {
          let targetPos = new THREE.Vector3();
          modelEntity.object3D.getWorldPosition(targetPos);
          lastGlobalPos.lerp(targetPos, smoothingFactor);
          console.log("Continuous mode, final smoothed position:", lastGlobalPos);
          // Reparent to the scene, preserving the last world transform.
          reparentPreservingWorldTransform(modelEntity, sceneEl);
        }
        else if (anchoringMode === "once") {
          // In once mode the model remains anchored from the first detection.
          console.log("Once mode: model remains anchored at", lastGlobalPos);
        }
      });
  
      // For continuous mode, periodically update the global coordinate while the marker is visible.
      if (anchoringMode === "continuous") {
        setInterval(() => {
          if (markerEl.object3D.visible) {
            let targetPos = new THREE.Vector3();
            markerEl.object3D.getWorldPosition(targetPos);
            lastGlobalPos.lerp(targetPos, smoothingFactor);
            console.log(
              `Continuous mode: updated global position: x=${lastGlobalPos.x.toFixed(2)}, y=${lastGlobalPos.y.toFixed(2)}, z=${lastGlobalPos.z.toFixed(2)}`
            );
          }
        }, 500);
      }
      
      // Optional logging of the marker's transformation.
      if (markerEl.object3D) {
        setInterval(() => {
          const pos = markerEl.object3D.position;
          const rot = markerEl.object3D.rotation;
          console.log(
            `Marker position: x=${pos.x.toFixed(2)}, y=${pos.y.toFixed(2)}, z=${pos.z.toFixed(2)}; ` +
            `rotation: x=${rot.x.toFixed(2)}, y=${rot.y.toFixed(2)}, z=${rot.z.toFixed(2)}`
          );
        }, 2000);
      }
    } else {
      console.error('Marker element not found!');
    }
  
    // Extract the "id" parameter from the URL, e.g. ?id=test-model
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
  
    // Create an AbortController with a custom timeout.
    const controller = new AbortController();
    const timeoutMs = 15000;
    const timeoutID = setTimeout(() => {
      console.error(`Fetch request timed out after ${timeoutMs}ms`);
      controller.abort();
    }, timeoutMs);
  
    // Fetch model data using the POST request with a JSON payload.
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
  
        // Parse each entry's 'data' property containing JSON glTF content.
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
          console.error("No valid model JSON found after parsing.");
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
          console.error("No valid blob URLs generated from the model data.");
          return;
        }
  
        // Set the initially fetched model.
        console.log("Setting initial model URL:", modelUrls[0]);
        modelEntity.setAttribute('gltf-model', modelUrls[0]);
  
        // If there are multiple models, cycle through them every 5 seconds.
        if (modelUrls.length > 1) {
          let currentIndex = 0;
          console.log("Multiple models detected. Cycling through models every 5 seconds.");
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