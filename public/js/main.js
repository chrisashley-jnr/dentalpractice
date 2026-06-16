// public/js/main.js

document.addEventListener('DOMContentLoaded', () => {
  // Mobile navigation toggle
  const toggle = document.querySelector('.nav-toggle');
  const navLinks = document.querySelector('.nav-links');
  if (toggle && navLinks) {
    toggle.addEventListener('click', () => {
      const isOpen = navLinks.classList.toggle('is-open');
      toggle.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
    });
  }

  // Live availability check on the booking form (calls /api/availability)
  const dentistSelect = document.getElementById('dentist_id');
  const dateInput = document.getElementById('appointment_date');
  const timeSelect = document.getElementById('appointment_time');

  async function refreshAvailability() {
    if (!dentistSelect || !dateInput || !timeSelect) return;
    if (!dentistSelect.value || !dateInput.value) return;

    const res = await fetch(`/api/availability?dentist_id=${dentistSelect.value}&date=${dateInput.value}`);
    if (!res.ok) return;
    const data = await res.json();
    const taken = new Set(data.taken || []);

    [...timeSelect.options].forEach(opt => {
      if (!opt.value) return;
      const wasTaken = opt.dataset.taken === '1';
      if (taken.has(opt.value)) {
        opt.disabled = true;
        opt.textContent = opt.textContent.replace(' (unavailable)', '') + ' (unavailable)';
        opt.dataset.taken = '1';
      } else if (wasTaken) {
        opt.disabled = false;
        opt.textContent = opt.textContent.replace(' (unavailable)', '');
        opt.dataset.taken = '0';
      }
    });

    if (timeSelect.value && taken.has(timeSelect.value)) {
      timeSelect.value = '';
    }
  }

  if (dentistSelect) dentistSelect.addEventListener('change', refreshAvailability);
  if (dateInput) dateInput.addEventListener('change', refreshAvailability);

  // Simple client-side password confirmation check on register form
  const regForm = document.getElementById('register-form');
  if (regForm) {
    regForm.addEventListener('submit', (e) => {
      const pw = document.getElementById('password');
      const confirm = document.getElementById('confirm_password');
      if (pw && confirm && pw.value !== confirm.value) {
        e.preventDefault();
        alert('Passwords do not match. Please check and try again.');
      }
    });
  }

  const closeModal = (modal) => {
    if (!modal) return;
    modal.classList.remove('is-open');
    modal.setAttribute('hidden', '');
  };

  const openModal = (modal) => {
    if (!modal) return;
    modal.removeAttribute('hidden');
    requestAnimationFrame(() => modal.classList.add('is-open'));
  };

  document.addEventListener('click', (e) => {
    const opener = e.target.closest('[data-modal-target]');
    if (opener) {
      openModal(document.getElementById(opener.dataset.modalTarget));
      return;
    }

    const closeButton = e.target.closest('[data-modal-close]');
    if (closeButton) {
      closeModal(closeButton.closest('.modal-backdrop'));
      return;
    }

    if (e.target.classList.contains('modal-backdrop')) {
      closeModal(e.target);
    }
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      document.querySelectorAll('.modal-backdrop.is-open').forEach(closeModal);
    }
  });

  document.addEventListener('submit', (e) => {
    const message = e.target.dataset.confirm;
    if (message && !window.confirm(message)) {
      e.preventDefault();
    }
  });
});
