//==    SCRIPT FOR NAVIGATION BAR MANAGEMENT

    // Elements Selector Controls
    const hamburger = document.getElementById('hamburger');
    const navlist = document.getElementById('navlist');
    const navAuthContainer = document.getElementById('navAuthContainer');

    // Drawer Toggler for Mobile Layouts
    hamburger.addEventListener('click', () => {
      navlist.classList.toggle('open');
      hamburger.classList.toggle('toggle');
    });

    // Check Auth State: If true, swap the sign-in button for a mock profile element
    function checkLoginState() {
      const isLoggedIn = localStorage.getItem('isLoggedIn');
      const userType = localStorage.getItem('userType'); // 'volunteer' or 'ngo'

      if (isLoggedIn === 'true') {
        navAuthContainer.innerHTML = `
          <div class="profile-badge">
            <div class="profile-avatar"><i class="fa-solid fa-user"></i></div>
            <div class="profile-dropdown">
              <p class="user-role">${userType === 'ngo' ? 'NGO Dashboard' : 'My Account'}</p>
              <a href="#" onclick="handleLogout(event)" class="logout-btn">Log Out</a>
            </div>
          </div>
        `;
      }
    }

    // Clear session storage and reload layout view
    function handleLogout(e) {
      e.preventDefault();
      localStorage.removeItem('isLoggedIn');
      localStorage.removeItem('userType');
      window.location.reload();
    }

    // Run Auth checks upon document render cycle
    document.addEventListener('DOMContentLoaded', checkLoginState);
