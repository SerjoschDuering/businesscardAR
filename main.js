document.addEventListener('DOMContentLoaded', () => {
    // Log when the A-Frame scene is loaded.
    const sceneEl = document.querySelector('a-scene');
    if (sceneEl) {
      sceneEl.addEventListener('loaded', () => {
        console.log('A-Frame scene loaded!');
      });
    }
  
    // Get the dummy box element (the cube) so we can reparent it later.
    const dummyBox = document.getElementById('dummy-box');
  
    // Attach marker event listeners to log tracker events and reparent the cube.
    const markerEl = document.getElementById('marker');
    if (markerEl) {
      markerEl.addEventListener('markerFound', () => {
        console.log('Marker found!');
        // When marker is found, attach the dummy cube as a child so it follows the marker.
        // Only reparent if needed.
        if (dummyBox.parentNode !== markerEl) {
          // Compute current world position before reparenting (optional—if you want to persist any offset).
          const worldPos = new THREE.Vector3();
          dummyBox.object3D.getWorldPosition(worldPos);
          console.log('DummyBox world position before reparenting:', worldPos);
  
          // Reparent the dummy box to the marker.
          markerEl.appendChild(dummyBox);
          // Optionally, reset its local position (so that it “sticks” at the marker’s reference point or adjust as desired)
          dummyBox.setAttribute('position', "0 0 0");
        }
        dummyBox.setAttribute('color', 'green');
      });
      markerEl.addEventListener('markerLost', () => {
        console.log('Marker lost!');
        // When marker is lost, compute the cube’s last known world position...
        const worldPos = new THREE.Vector3();
        dummyBox.object3D.getWorldPosition(worldPos);
        console.log('DummyBox world position at marker lost:', worldPos);
  
        // Detach dummy box from marker so that it stays at the last known world position.
        // Append it back to the scene.
        sceneEl.appendChild(dummyBox);
        // Now update its position attribute with the world coordinates
        dummyBox.setAttribute('position', `${worldPos.x} ${worldPos.y} ${worldPos.z}`);
        dummyBox.setAttribute('color', 'red');
      });
  
      // Add periodic logging of marker's transformation.
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
  
    // Fetch model data using POST.
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
        let currentIndex = 0;
        const modelEntity = document.getElementById('model-container');
        console.log("Setting initial model URL:", modelUrls[currentIndex]);
        modelEntity.setAttribute('gltf-model', modelUrls[currentIndex]);
  
        // If multiple models are available, cycle through them every 5 seconds.
        if (modelUrls.length > 1) {
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