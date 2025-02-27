document.addEventListener('DOMContentLoaded', () => {
    // Extract the "id" parameter from the URL
    const params = new URLSearchParams(window.location.search);
    const modelId = params.get('id');
  
    if (!modelId) {
      console.error("No model ID provided in the URL.");
      return;
    }
  
    // Build the n8n endpoint URL (replace with your actual endpoint)
    const endpoint = 'https://your-n8n-endpoint.com/getModels?id=' + modelId;
  
    // Fetch model URLs from the n8n endpoint
    fetch(endpoint)
      .then(response => response.json())
      .then(data => {
        if (data.models && data.models.length > 0) {
          const modelUrls = data.models;
          let currentIndex = 0;
          const modelEntity = document.getElementById('model-container');
  
          // Set the initial model URL
          modelEntity.setAttribute('gltf-model', modelUrls[currentIndex]);
  
          // If more than one model is returned, cycle through them every 5 seconds
          if (modelUrls.length > 1) {
            setInterval(() => {
              currentIndex = (currentIndex + 1) % modelUrls.length;
              modelEntity.setAttribute('gltf-model', modelUrls[currentIndex]);
            }, 5000);
          }
        } else {
          console.error("No models found for the provided ID.");
        }
      })
      .catch(error => {
        console.error("Error fetching models: ", error);
      });
  });
  