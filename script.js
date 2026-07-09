// --- Replace older auth functions with this ---

function checkAuthStatus() {
  const isLoggedIn = localStorage.getItem('isLoggedIn');
  
  const loginBtn = document.getElementById('loginNavBtn');
  const signupBtn = document.getElementById('signupNavBtn');
  const profileDropdown = document.getElementById('navProfileDropdown');
  const profileLink = document.getElementById('navProfileLink'); // Optional link in nav center

  if (isLoggedIn === 'true') {
    loginBtn.style.display = 'none';
    signupBtn.style.display = 'none';
    profileDropdown.style.display = 'inline-block';
    if (profileLink) profileLink.style.display = 'inline-block';

    // Retrieve saved user profile details or use defaults
    const savedName = localStorage.getItem('profileName') || 'Volunteer User';
    const savedAvatar = localStorage.getItem('profileAvatar') || 'images/default-avatar.png';

    // Apply values to UI elements
    document.getElementById('navUsername').innerText = savedName;
    document.getElementById('menuFullname').innerText = savedName;
    document.getElementById('navAvatar').src = savedAvatar;
  } else {
    loginBtn.style.display = 'inline-block';
    signupBtn.style.display = 'inline-block';
    profileDropdown.style.display = 'none';
    if (profileLink) profileLink.style.display = 'none';
  }
}

// Toggles opening and closing the menu dropdown box
function toggleDropdown(event) {
  event.stopPropagation();
  document.getElementById('dropdownMenu').classList.toggle('show');
}

// Close menu automatically if user clicks completely off the element
window.addEventListener('click', function() {
  const menu = document.getElementById('dropdownMenu');
  if (menu && menu.classList.contains('show')) {
    menu.classList.remove('show');
  }
});

/* Modal Configuration Logics */
function openEditModal() {
  const currentName = localStorage.getItem('profileName') || 'Volunteer User';
  const currentAvatar = localStorage.getItem('profileAvatar') || 'images/default-avatar.png';
  
  document.getElementById('editNameField').value = currentName;
  document.getElementById('modalAvatarPreview').src = currentAvatar;
  document.getElementById('editProfileModal').style.display = 'flex';
}

function closeEditModal() {
  document.getElementById('editProfileModal').style.display = 'none';
}

// Reads local user file uploads to translate photos to active browser URLs
function previewAvatar(event) {
  const reader = new FileReader();
  reader.onload = function() {
    document.getElementById('modalAvatarPreview').src = reader.result;
  };
  if(event.target.files[0]) {
    reader.readAsDataURL(event.target.files[0]);
  }
}

function saveProfileChanges(event) {
  event.preventDefault();
  const newName = document.getElementById('editNameField').value;
  const newAvatarSrc = document.getElementById('modalAvatarPreview').src;

  localStorage.setItem('profileName', newName);
  localStorage.setItem('profileAvatar', newAvatarSrc);

  closeEditModal();
  checkAuthStatus(); // Refresh Navbar components to display the updates instantly
}

function logout() {
  localStorage.removeItem('isLoggedIn');
  window.location.reload();
}

window.addEventListener('DOMContentLoaded', checkAuthStatus);