document.addEventListener('DOMContentLoaded', () => {
    // Global variable to keep track of the model's last known world position.
    let lastGlobalPos = new THREE.Vector3();
    // Smoothing factor between 0 and 1 (lower values = more smoothing).
    const smoothingFactor = 0.2;
  
    // Log when the A-Frame scene is loaded.
    const sceneEl = document.querySelector('a-scene');
    if (sceneEl) {
      sceneEl.addEventListener('loaded', () => {
        console.log('A-Frame scene loaded!');
      });
    }
  
    // Get the model that was fetched (the AR content).
    const modelEntity = document.getElementById('model-container');
  
    // Attach marker event listeners. We'll use these to update our global coordinate
    // and to reparent the model container so that it either tracks the marker or
    // stays fixed at its last known (and smoothed) position.
    const markerEl = document.getElementById('marker');
    if (markerEl) {
      markerEl.addEventListener('markerFound', () => {
        console.log('Marker found!');
        // Update global position from the model's (or marker's) world coordinates.
        let targetPos = new THREE.Vector3();
        markerEl.object3D.getWorldPosition(targetPos);
        lastGlobalPos.copy(targetPos); // initialize smoothed position
        console.log('Updating global position on markerFound:', lastGlobalPos);
  
        // Reparent the model to the marker (if needed) to follow its transform.
        if (modelEntity.parentNode !== markerEl) {
          markerEl.appendChild(modelEntity);
          // Reset local position so it attaches correctly to the marker.
          modelEntity.setAttribute('position', "0 0 0");
        }
        // (Optional) Change visual properties to indicate tracking.
        modelEntity.setAttribute('visible', true);
      });
  
      markerEl.addEventListener('markerLost', () => {
        console.log('Marker lost!');
        // On marker lost, first update the last global position one more time.
        let targetPos = new THREE.Vector3();
        modelEntity.object3D.getWorldPosition(targetPos);
        lastGlobalPos.lerp(targetPos, smoothingFactor);
        console.log('Model last known (smoothed) world position:', lastGlobalPos);
  
        // Detach the model from the marker: reparent it back to the scene.
        sceneEl.appendChild(modelEntity);
        // Set its position to that last known world coordinate so it stays in place.
        modelEntity.setAttribute('position', `${lastGlobalPos.x} ${lastGlobalPos.y} ${lastGlobalPos.z}`);
      });
  
      // Periodically update the global position using a smoothing function.
      setInterval(() => {
        if (markerEl.object3D.visible) {
          let targetPos = new THREE.Vector3();
          markerEl.object3D.getWorldPosition(targetPos);
          // Smoothly interpolate the current smoothed position toward the new measurement.
          lastGlobalPos.lerp(targetPos, smoothingFactor);
          console.log(
            `Smoothed global position updated: x=${lastGlobalPos.x.toFixed(2)}, y=${lastGlobalPos.y.toFixed(2)}, z=${lastGlobalPos.z.toFixed(2)}`
          );
        }
      }, 500);
      
      // Optionally, log the marker's transformation every 2 seconds.
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
  
    // Fetch model data using the POST request with JSON payload.
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