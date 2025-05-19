// Debug script to check authentication status and cookies
console.log('Debug: Current cookies:', document.cookie);

// Check if we have authToken
const cookies = document.cookie.split(';').reduce((acc, cookie) => {
    const [key, value] = cookie.trim().split('=');
    acc[key] = value;
    return acc;
}, {});

console.log('Debug: Parsed cookies:', cookies);
console.log('Debug: AuthToken exists?', !!cookies.authToken);

// Test API endpoint with detailed logging
async function testSocialAPI() {
    console.log('Testing social network API...');
    
    try {
        const response = await fetch('/api/social-networks', {
            method: 'GET',
            credentials: 'same-origin'
        });
        
        console.log('Response status:', response.status);
        console.log('Response headers:', response.headers);
        
        const data = await response.json();
        console.log('Response data:', data);
    } catch (error) {
        console.error('API test error:', error);
    }
}

// Run test automatically
testSocialAPI();