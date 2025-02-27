document.addEventListener('DOMContentLoaded', () => {
    // Extract the "id" parameter from the URL, e.g. http://127.0.0.1:5501/index.html?id=test-model
    const params = new URLSearchParams(window.location.search);
    const modelId = params.get('id');
  
    if (!modelId) {
      console.error("No model ID provided in the URL.");
      return;
    }
    console.log("Extracted model ID:", modelId);
  
    // Define your n8n endpoint
    const endpoint = 'https://run8n.xyz/webhook-test/getGLTF';
    console.log("Fetching models from endpoint:", endpoint);
  
    // Create an AbortController to add a custom timeout
    const controller = new AbortController();
    const timeoutMs = 15000; // Timeout set to 15 seconds (adjust if needed)
    const timeoutID = setTimeout(() => {
      console.error(`Fetch request timed out after ${timeoutMs}ms`);
      controller.abort();
    }, timeoutMs);
  
    // Fetch model data using the POST request with JSON payload
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
          // Continue processing...
        })
        .catch(error => {
          if (error.name === 'AbortError') {
            console.error("Fetch request aborted due to timeout.");
          } else {
            console.error("Error fetching models:", error);
          }
        });
    });
        // Parse each entry's 'data' property which should contain the JSON glTF content
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
  
        // Create Blob URLs from the glTF JSON objects. This allows A-Frame's gltf-model component to load them.
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
  
        let currentIndex = 0;
        const modelEntity = document.getElementById('model-container');
        console.log("Setting initial model URL:", modelUrls[currentIndex]);
        modelEntity.setAttribute('gltf-model', modelUrls[currentIndex]);
  
        // If more than one model is returned, cycle through them every 5 seconds
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