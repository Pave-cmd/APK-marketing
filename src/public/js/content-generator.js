/**
 * Content Generator Frontend Script
 * Handles interaction with the content generation API
 */
document.addEventListener('DOMContentLoaded', function() {
  console.log('[CONTENT-GEN] DOM loaded, initializing content generator...');
  
  // Form elements
  const generateContentForm = document.getElementById('generateContentForm');
  const generateVariationsBtn = document.getElementById('generateVariations');
  const contentResults = document.getElementById('contentResults');
  const contentHistoryBody = document.getElementById('contentHistoryBody');
  
  // Modal elements
  const contentPreviewModal = new bootstrap.Modal(document.getElementById('contentPreviewModal'));
  const contentPreviewBody = document.getElementById('contentPreviewBody');
  const scheduleContentBtn = document.getElementById('scheduleContentBtn');
  const publishContentBtn = document.getElementById('publishContentBtn');
  
  // Check if essential elements exist
  if (!generateContentForm) {
    console.error('[CONTENT-GEN] generateContentForm not found!');
    return;
  }
  
  // CSRF token from meta tag
  const csrfToken = document.querySelector('meta[name="csrf-token"]')?.content;
  
  // Debug cookies and tokens
  console.log('[CONTENT-GEN] CSRF Token:', csrfToken);
  console.log('[CONTENT-GEN] All cookies:', document.cookie);
  console.log('[CONTENT-GEN] AuthToken cookie:', document.cookie.split(';').find(c => c.trim().startsWith('authToken=')));
  
  // Test API connectivity
  console.log('[CONTENT-GEN] Testing API connectivity...');
  fetch('/api/content/history', {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      'X-CSRF-Token': csrfToken
    },
    credentials: 'include'
  })
  .then(response => {
    console.log('[CONTENT-GEN] History API test response status:', response.status);
    return response.json();
  })
  .then(data => {
    console.log('[CONTENT-GEN] History API test response data:', data);
  })
  .catch(error => {
    console.error('[CONTENT-GEN] History API test failed:', error);
  });
  
  /**
   * Load content history from the server
   */
  function loadContentHistory() {
    fetch('/api/content/history', {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-Token': csrfToken
      },
      credentials: 'include'
    })
    .then(response => response.json())
    .then(data => {
      if (data.success && data.content && data.content.length > 0) {
        contentHistoryBody.innerHTML = '';
        
        data.content.forEach(item => {
          const date = new Date(item.createdAt).toLocaleString();
          const row = document.createElement('tr');
          
          row.innerHTML = `
            <td>${date}</td>
            <td>${item.websiteUrl}</td>
            <td>${item.socialPlatforms[0]?.platform || 'N/A'}</td>
            <td>${item.textContent.substring(0, 50)}...</td>
            <td>
              <button class="btn btn-sm btn-primary preview-btn" data-id="${item._id}">Náhled</button>
              <button class="btn btn-sm btn-success publish-btn" data-id="${item._id}">Publikovat</button>
              <button class="btn btn-sm btn-danger delete-btn" data-id="${item._id}">Smazat</button>
            </td>
          `;
          
          contentHistoryBody.appendChild(row);
        });
        
        // Add event listeners to the buttons
        document.querySelectorAll('.preview-btn').forEach(btn => {
          btn.addEventListener('click', function() {
            const contentId = this.getAttribute('data-id');
            previewContent(contentId);
          });
        });
        
        document.querySelectorAll('.publish-btn').forEach(btn => {
          btn.addEventListener('click', function() {
            const contentId = this.getAttribute('data-id');
            publishContent(contentId);
          });
        });
        
        document.querySelectorAll('.delete-btn').forEach(btn => {
          btn.addEventListener('click', function() {
            const contentId = this.getAttribute('data-id');
            deleteContent(contentId);
          });
        });
      } else {
        contentHistoryBody.innerHTML = '<tr><td colspan="5" class="text-center">Žádný vygenerovaný obsah nenalezen.</td></tr>';
      }
    })
    .catch(error => {
      console.error('Error loading content history:', error);
      showNotification('Chyba při načítání historie obsahu', 'danger');
    });
  }
  
  /**
   * Generate content from the form data
   * @param {Event} event Form submit event
   */
  function generateContent(event) {
    event.preventDefault();
    
    console.log('[CONTENT-GEN] Starting content generation...');
    
    const websiteUrl = document.getElementById('websiteUrl').value;
    const platform = document.getElementById('platform').value;
    const tone = document.getElementById('tone').value;
    const contentType = document.getElementById('contentType').value;
    
    console.log('[CONTENT-GEN] Form values:', { websiteUrl, platform, tone, contentType });
    
    if (!websiteUrl || !platform || !tone || !contentType) {
      console.log('[CONTENT-GEN] Missing required fields');
      showNotification('Vyplňte prosím všechna pole', 'warning');
      return;
    }
    
    // Show loading indicator
    contentResults.innerHTML = '<div class="text-center"><div class="spinner-border" role="status"><span class="visually-hidden">Generuji obsah...</span></div><p class="mt-2">Generuji obsah, prosím čekejte...</p></div>';
    
    // Send request to the API
    console.log('[CONTENT-GEN] Sending API request...');
    fetch('/api/content/generate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-Token': csrfToken
      },
      body: JSON.stringify({
        websiteUrl,
        platform,
        tone,
        contentType
      }),
      credentials: 'include'
    })
    .then(response => {
      console.log('[CONTENT-GEN] Response status:', response.status);
      return response.json();
    })
    .then(data => {
      console.log('[CONTENT-GEN] Response data:', data);
      if (data.success && data.content) {
        // Display the generated content
        displayGeneratedContent([data.content]);
        // Refresh the content history
        loadContentHistory();
        showNotification('Obsah byl úspěšně vygenerován', 'success');
        
        // DON'T reset the form - keep the values so user can generate more variations
        console.log('[CONTENT-GEN] Content generation successful, keeping form values');
      } else {
        console.log('[CONTENT-GEN] API error:', data.error);
        contentResults.innerHTML = `<div class="alert alert-danger">Chyba při generování obsahu: ${data.error || 'Neznámá chyba'}</div>`;
      }
    })
    .catch(error => {
      console.error('[CONTENT-GEN] Fetch error:', error);
      contentResults.innerHTML = '<div class="alert alert-danger">Nepodařilo se vygenerovat obsah. Zkuste to prosím znovu.</div>';
    });
  }
  
  /**
   * Generate multiple content variations
   */
  function generateVariations() {
    const websiteUrl = document.getElementById('websiteUrl').value;
    const platform = document.getElementById('platform').value;
    
    if (!websiteUrl || !platform) {
      showNotification('Vyberte prosím webovou stránku a sociální síť', 'warning');
      return;
    }
    
    // Show loading indicator
    contentResults.innerHTML = '<div class="text-center"><div class="spinner-border" role="status"><span class="visually-hidden">Generuji varianty obsahu...</span></div><p class="mt-2">Generuji různé varianty obsahu, prosím čekejte...</p></div>';
    
    // Send request to the API
    fetch('/api/content/generate-variations', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-Token': csrfToken
      },
      body: JSON.stringify({
        websiteUrl,
        platform,
        count: 3 // Generate 3 variations
      }),
      credentials: 'include'
    })
    .then(response => response.json())
    .then(data => {
      if (data.success && data.variations) {
        // Display the generated variations
        displayGeneratedContent(data.variations);
        // Refresh the content history
        loadContentHistory();
        showNotification('Varianty obsahu byly úspěšně vygenerovány', 'success');
      } else {
        contentResults.innerHTML = `<div class="alert alert-danger">Chyba při generování variant obsahu: ${data.error}</div>`;
      }
    })
    .catch(error => {
      console.error('Error generating content variations:', error);
      contentResults.innerHTML = '<div class="alert alert-danger">Nepodařilo se vygenerovat varianty obsahu. Zkuste to prosím znovu.</div>';
    });
  }
  
  /**
   * Display generated content in the results section
   * @param {Array} contentItems Array of generated content items
   */
  function displayGeneratedContent(contentItems) {
    contentResults.innerHTML = '';
    
    const container = document.createElement('div');
    
    if (contentItems.length > 1) {
      // Create tabs for multiple variations
      const tabList = document.createElement('ul');
      tabList.className = 'nav nav-tabs mb-3';
      tabList.id = 'contentTabs';
      
      const tabContent = document.createElement('div');
      tabContent.className = 'tab-content';
      tabContent.id = 'contentTabContent';
      
      contentItems.forEach((item, index) => {
        // Create tab
        const tab = document.createElement('li');
        tab.className = 'nav-item';
        
        const tabLink = document.createElement('a');
        tabLink.className = index === 0 ? 'nav-link active' : 'nav-link';
        tabLink.id = `content-tab-${index}`;
        tabLink.setAttribute('data-bs-toggle', 'tab');
        tabLink.setAttribute('href', `#content-panel-${index}`);
        tabLink.setAttribute('role', 'tab');
        tabLink.setAttribute('aria-controls', `content-panel-${index}`);
        tabLink.setAttribute('aria-selected', index === 0 ? 'true' : 'false');
        tabLink.textContent = `Varianta ${index + 1}`;
        
        tab.appendChild(tabLink);
        tabList.appendChild(tab);
        
        // Create tab panel
        const tabPanel = document.createElement('div');
        tabPanel.className = index === 0 ? 'tab-pane fade show active' : 'tab-pane fade';
        tabPanel.id = `content-panel-${index}`;
        tabPanel.setAttribute('role', 'tabpanel');
        tabPanel.setAttribute('aria-labelledby', `content-tab-${index}`);
        
        tabPanel.appendChild(createContentCard(item, index));
        tabContent.appendChild(tabPanel);
      });
      
      container.appendChild(tabList);
      container.appendChild(tabContent);
    } else if (contentItems.length === 1) {
      // Simple display for single content
      container.appendChild(createContentCard(contentItems[0], 0));
    } else {
      container.innerHTML = '<div class="alert alert-info">Žádný obsah nebyl vygenerován.</div>';
    }
    
    contentResults.appendChild(container);
  }
  
  /**
   * Create a card for displaying generated content
   * @param {Object} content Content object
   * @param {number} index Index for identification
   * @returns {HTMLElement} Card element
   */
  function createContentCard(content, index) {
    const card = document.createElement('div');
    card.className = 'card';
    card.setAttribute('data-content-id', content._id);
    
    // Card header with metadata
    const cardHeader = document.createElement('div');
    cardHeader.className = 'card-header d-flex justify-content-between align-items-center';
    
    const platformBadge = document.createElement('span');
    platformBadge.className = `badge bg-${getPlatformColor(content.socialPlatforms[0]?.platform)}`;
    platformBadge.textContent = content.socialPlatforms[0]?.platform?.toUpperCase() || 'N/A';
    
    const actionButtons = document.createElement('div');
    
    const scheduleBtn = document.createElement('button');
    scheduleBtn.className = 'btn btn-sm btn-primary me-2 schedule-btn';
    scheduleBtn.textContent = 'Naplánovat';
    scheduleBtn.addEventListener('click', () => scheduleContentFromCard(content._id));
    
    const publishBtn = document.createElement('button');
    publishBtn.className = 'btn btn-sm btn-success publish-card-btn';
    publishBtn.textContent = 'Publikovat nyní';
    publishBtn.addEventListener('click', () => publishContentFromCard(content._id));
    
    actionButtons.appendChild(scheduleBtn);
    actionButtons.appendChild(publishBtn);
    
    cardHeader.appendChild(platformBadge);
    cardHeader.appendChild(actionButtons);
    
    // Card body with content
    const cardBody = document.createElement('div');
    cardBody.className = 'card-body';
    
    const contentText = document.createElement('p');
    contentText.className = 'card-text';
    contentText.textContent = content.textContent;
    
    const hashtagsContainer = document.createElement('div');
    hashtagsContainer.className = 'mt-3';
    
    if (content.tags && content.tags.length > 0) {
      content.tags.forEach(tag => {
        const hashtagBadge = document.createElement('span');
        hashtagBadge.className = 'badge bg-secondary me-1';
        hashtagBadge.textContent = tag;
        hashtagsContainer.appendChild(hashtagBadge);
      });
    }
    
    cardBody.appendChild(contentText);
    cardBody.appendChild(hashtagsContainer);
    
    // Assemble the card
    card.appendChild(cardHeader);
    card.appendChild(cardBody);
    
    return card;
  }
  
  /**
   * Get color class for a platform badge
   * @param {string} platform Platform name
   * @returns {string} Color class name
   */
  function getPlatformColor(platform) {
    const colors = {
      'facebook': 'primary',
      'twitter': 'info',
      'instagram': 'danger',
      'linkedin': 'success'
    };
    
    return colors[platform] || 'secondary';
  }
  
  /**
   * Preview a content item
   * @param {string} contentId Content ID
   */
  function previewContent(contentId) {
    fetch(`/api/content/${contentId}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-Token': csrfToken
      },
      credentials: 'include'
    })
    .then(response => response.json())
    .then(data => {
      if (data.success && data.content) {
        const content = data.content;
        
        // Set up modal content
        contentPreviewBody.innerHTML = `
          <div class="mb-3">
            <strong>Webová stránka:</strong> ${content.websiteUrl}
          </div>
          <div class="mb-3">
            <strong>Sociální síť:</strong> ${content.socialPlatforms[0]?.platform || 'N/A'}
          </div>
          <div class="mb-3">
            <strong>Text:</strong>
            <p class="mt-2">${content.textContent}</p>
          </div>
          <div class="mb-3">
            <strong>Hashtagy:</strong>
            <div class="mt-2">
              ${content.tags.map(tag => `<span class="badge bg-secondary me-1">${tag}</span>`).join('')}
            </div>
          </div>
        `;
        
        // Set up action buttons
        scheduleContentBtn.setAttribute('data-content-id', content._id);
        publishContentBtn.setAttribute('data-content-id', content._id);
        
        // Show the modal
        contentPreviewModal.show();
      } else {
        showNotification('Obsah nebyl nalezen', 'danger');
      }
    })
    .catch(error => {
      console.error('Error fetching content:', error);
      showNotification('Nepodařilo se načíst obsah', 'danger');
    });
  }
  
  /**
   * Publish content to social media
   * @param {string} contentId Content ID
   */
  function publishContent(contentId) {
    fetch(`/api/content/${contentId}/publish`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-Token': csrfToken
      },
      credentials: 'include'
    })
    .then(response => response.json())
    .then(data => {
      if (data.success) {
        showNotification('Obsah byl úspěšně publikován', 'success');
        loadContentHistory();
        
        // Close the modal if it's open
        if (contentPreviewModal._isShown) {
          contentPreviewModal.hide();
        }
      } else {
        showNotification(`Chyba při publikování obsahu: ${data.error}`, 'danger');
      }
    })
    .catch(error => {
      console.error('Error publishing content:', error);
      showNotification('Nepodařilo se publikovat obsah', 'danger');
    });
  }
  
  /**
   * Schedule content for later publishing
   * @param {string} contentId Content ID
   */
  function scheduleContent(contentId) {
    // Here you would typically open another modal for scheduling
    // For simplicity, we'll just use a fixed date 1 day in the future
    const scheduledDate = new Date();
    scheduledDate.setDate(scheduledDate.getDate() + 1);
    
    fetch(`/api/content/${contentId}/schedule`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-Token': csrfToken
      },
      body: JSON.stringify({
        scheduledFor: scheduledDate.toISOString()
      }),
      credentials: 'include'
    })
    .then(response => response.json())
    .then(data => {
      if (data.success) {
        showNotification('Obsah byl úspěšně naplánován', 'success');
        loadContentHistory();
        
        // Close the modal if it's open
        if (contentPreviewModal._isShown) {
          contentPreviewModal.hide();
        }
      } else {
        showNotification(`Chyba při plánování obsahu: ${data.error}`, 'danger');
      }
    })
    .catch(error => {
      console.error('Error scheduling content:', error);
      showNotification('Nepodařilo se naplánovat obsah', 'danger');
    });
  }
  
  /**
   * Delete content
   * @param {string} contentId Content ID
   */
  function deleteContent(contentId) {
    if (confirm('Opravdu chcete smazat tento obsah?')) {
      fetch(`/api/content/${contentId}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': csrfToken
        },
        credentials: 'include'
      })
      .then(response => response.json())
      .then(data => {
        if (data.success) {
          showNotification('Obsah byl úspěšně smazán', 'success');
          loadContentHistory();
        } else {
          showNotification(`Chyba při mazání obsahu: ${data.error}`, 'danger');
        }
      })
      .catch(error => {
        console.error('Error deleting content:', error);
        showNotification('Nepodařilo se smazat obsah', 'danger');
      });
    }
  }
  
  /**
   * Helper functions for content actions from card
   */
  function publishContentFromCard(contentId) {
    publishContent(contentId);
  }
  
  function scheduleContentFromCard(contentId) {
    scheduleContent(contentId);
  }
  
  /**
   * Display a notification
   * @param {string} message Notification message
   * @param {string} type Notification type (success, warning, danger)
   */
  function showNotification(message, type = 'info') {
    // Check if notification container exists, create if not
    let notifContainer = document.getElementById('notificationContainer');
    if (!notifContainer) {
      notifContainer = document.createElement('div');
      notifContainer.id = 'notificationContainer';
      notifContainer.className = 'position-fixed bottom-0 end-0 p-3';
      document.body.appendChild(notifContainer);
    }
    
    // Create notification element
    const notifId = 'notif-' + Date.now();
    const notif = document.createElement('div');
    notif.className = `toast align-items-center text-white bg-${type} border-0`;
    notif.setAttribute('role', 'alert');
    notif.setAttribute('aria-live', 'assertive');
    notif.setAttribute('aria-atomic', 'true');
    notif.id = notifId;
    
    notif.innerHTML = `
      <div class="d-flex">
        <div class="toast-body">
          ${message}
        </div>
        <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast" aria-label="Close"></button>
      </div>
    `;
    
    notifContainer.appendChild(notif);
    
    // Show the notification
    const toast = new bootstrap.Toast(notif, { autohide: true, delay: 5000 });
    toast.show();
    
    // Remove notification after it's hidden
    notif.addEventListener('hidden.bs.toast', function() {
      notif.remove();
    });
  }
  
  // Event Listeners
  generateContentForm.addEventListener('submit', generateContent);
  generateVariationsBtn.addEventListener('click', generateVariations);
  
  scheduleContentBtn.addEventListener('click', function() {
    const contentId = this.getAttribute('data-content-id');
    scheduleContent(contentId);
  });
  
  publishContentBtn.addEventListener('click', function() {
    const contentId = this.getAttribute('data-content-id');
    publishContent(contentId);
  });
  
  // Load content history when the page loads
  loadContentHistory();
});