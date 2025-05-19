// Simple test script to verify if scripts are loading
console.log('TEST: Script is loading correctly');

// Add a visual test button when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    console.log('TEST: DOM is ready');
    
    // Create and add test button
    const testBtn = document.createElement('button');
    testBtn.textContent = 'Test Social API';
    testBtn.className = 'btn btn-danger';
    testBtn.style.position = 'fixed';
    testBtn.style.bottom = '20px';
    testBtn.style.right = '20px';
    testBtn.style.zIndex = '9999';
    
    testBtn.onclick = async () => {
        alert('Button clicked! Testing API...');
        
        try {
            const response = await fetch('/api/social-networks/add', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                credentials: 'same-origin',
                body: JSON.stringify({
                    platform: 'facebook',
                    accountId: 'test-account',
                    profileUrl: 'https://facebook.com/test'
                })
            });
            
            const data = await response.json();
            alert('API Response: ' + JSON.stringify(data));
            console.log('API Response:', data);
        } catch (error) {
            alert('Error: ' + error.message);
            console.error('API Error:', error);
        }
    };
    
    document.body.appendChild(testBtn);
    console.log('TEST: Button added to page');
});