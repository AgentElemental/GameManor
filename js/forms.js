/**
 * GameManor Website Forms System
 * Handles client-side validation, attachments, submission, error handling,
 * and test-mode / live response visualization for Contact Us & Bug Reports.
 */

const GAMEMANOR_FORMS = (() => {
  // Primary Netlify Serverless Proxy (handles CORS preflight on Node side)
  const PROXY_ENDPOINT = '/api/submit-form';

  // Direct Google Apps Script Web App Endpoint
  const DIRECT_APPS_SCRIPT_ENDPOINT = 'https://script.google.com/macros/s/AKfycby-VzmPPro92tUOmazZQBqDxTxYfDtF-hj8yoKYmTeUJu8q5vIKB8KkUYsz5IP1Tz-q/exec';

  // Google Forms Direct URLs (for fallback and prefill links)
  const GOOGLE_FORM_URLS = {
    contact: 'https://docs.google.com/forms/d/e/1FAIpQLSc5FkNAhSuVm_AFhHUl6AvB6nIvpqZbclSRJb-se5V0ZtfGsg/viewform',
    bug: 'https://docs.google.com/forms/d/e/1FAIpQLSdUVKhg_4GFj-2FTr0aTDdvc0STrEobMepc-qKT8S5f1q31Nw/viewform'
  };

  const CONTACT_PREFILL_ENTRIES = {
    'Full Name': 'entry.1400967961',
    'Email Address': 'entry.1218960302',
    'Reason for Contact': 'entry.1947866949',
    'Subject': 'entry.145138672',
    'Message': 'entry.238968271',
    'GameManor Launcher Version': 'entry.1165419517',
    'Operating System': 'entry.69436623'
  };

  const BUG_PREFILL_ENTRIES = {
    'Full Name': 'entry.653558019',
    'Email Address': 'entry.894480112',
    'Bug Title': 'entry.814460636',
    'Bug Category': 'entry.663099699',
    'Severity': 'entry.880851038',
    'GameManor Launcher Version': 'entry.1539300084',
    'Windows Version': 'entry.1740804856',
    'Affected Game or Feature': 'entry.1028638421',
    'Steps to Reproduce': 'entry.421956261',
    'Expected Behavior': 'entry.786640414',
    'Actual Behavior': 'entry.1636096369',
    'Error Message or Exit Code': 'entry.904705205',
    'Screenshot and Video Attachment Links': 'entry.556126077',
    'Additional Details': 'entry.2137421026'
  };

  // Attachment Restrictions
  const ATTACHMENT_LIMITS = {
    maxFiles: 6,
    maxFileSize: 5 * 1024 * 1024, // 5 MB in bytes
    maxTotalSize: 8 * 1024 * 1024, // 8 MB in bytes
    allowedTypes: [
      'image/png',
      'image/jpeg',
      'image/webp',
      'video/mp4',
      'video/webm'
    ],
    allowedExtensions: ['.png', '.jpg', '.jpeg', '.webp', '.mp4', '.webm']
  };

  // Format bytes to human readable
  function formatBytes(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  // Convert File to Base64 data string
  function fileToBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        // reader.result is 'data:mime;base64,XXXXX'
        const base64Content = reader.result.split(',')[1] || '';
        resolve({
          name: file.name,
          filename: file.name,
          mimeType: file.type || 'application/octet-stream',
          size: file.size,
          data: base64Content,
          base64: base64Content
        });
      };
      reader.onerror = (err) => reject(err);
      reader.readAsDataURL(file);
    });
  }

  // Build direct prefilled Google Form URL
  function buildPrefilledUrl(formType, fields) {
    const baseUrl = GOOGLE_FORM_URLS[formType];
    const mapping = formType === 'contact' ? CONTACT_PREFILL_ENTRIES : BUG_PREFILL_ENTRIES;
    const params = new URLSearchParams();

    params.set('usp', 'pp_url');
    for (const [key, value] of Object.entries(fields)) {
      if (mapping[key] && value) {
        params.set(mapping[key], value);
      }
    }
    return `${baseUrl}?${params.toString()}`;
  }

  /* ====================================================================
     ATTACHMENT STATE MANAGER
     ==================================================================== */
  class AttachmentManager {
    constructor(containerEl, onChange) {
      this.containerEl = containerEl;
      this.onChange = onChange;
      this.files = []; // Array of File objects
      this.dropzoneEl = containerEl.querySelector('.attachment-dropzone');
      this.fileInputEl = containerEl.querySelector('.attachment-file-input');
      this.listEl = containerEl.querySelector('.attachment-list');
      this.meterFillEl = containerEl.querySelector('.attachment-meter-fill');
      this.meterTextEl = containerEl.querySelector('.attachment-meter-text');
      this.errorEl = containerEl.querySelector('.attachment-error-msg');

      this.init();
    }

    init() {
      if (!this.dropzoneEl || !this.fileInputEl) return;

      // Click to choose
      this.fileInputEl.addEventListener('change', (e) => {
        this.addFiles(Array.from(e.target.files));
        this.fileInputEl.value = ''; // Reset so same file can be re-added if removed
      });

      // Drag & Drop
      ['dragenter', 'dragover'].forEach(name => {
        this.dropzoneEl.addEventListener(name, (e) => {
          e.preventDefault();
          e.stopPropagation();
          this.dropzoneEl.classList.add('drag-over');
        });
      });

      ['dragleave', 'drop'].forEach(name => {
        this.dropzoneEl.addEventListener(name, (e) => {
          e.preventDefault();
          e.stopPropagation();
          this.dropzoneEl.classList.remove('drag-over');
        });
      });

      this.dropzoneEl.addEventListener('drop', (e) => {
        if (e.dataTransfer && e.dataTransfer.files) {
          this.addFiles(Array.from(e.dataTransfer.files));
        }
      });
    }

    setError(msg) {
      if (this.errorEl) {
        this.errorEl.textContent = msg;
        this.errorEl.style.display = msg ? 'flex' : 'none';
      }
    }

    getTotalSize() {
      return this.files.reduce((acc, f) => acc + f.size, 0);
    }

    addFiles(newFiles) {
      this.setError('');

      for (const file of newFiles) {
        // Count limit check
        if (this.files.length >= ATTACHMENT_LIMITS.maxFiles) {
          this.setError(`Maximum limit reached: You can attach at most ${ATTACHMENT_LIMITS.maxFiles} files.`);
          break;
        }

        // File type check
        const ext = '.' + file.name.split('.').pop().toLowerCase();
        const isValidMime = ATTACHMENT_LIMITS.allowedTypes.includes(file.type);
        const isValidExt = ATTACHMENT_LIMITS.allowedExtensions.includes(ext);

        if (!isValidMime && !isValidExt) {
          this.setError(`"${file.name}" is not supported. Supported: PNG, JPG, WebP, MP4, WebM.`);
          continue;
        }

        // Individual file size check (5 MB)
        if (file.size > ATTACHMENT_LIMITS.maxFileSize) {
          this.setError(`"${file.name}" (${formatBytes(file.size)}) exceeds the 5 MB per-file limit.`);
          continue;
        }

        // Total size limit check (8 MB)
        if (this.getTotalSize() + file.size > ATTACHMENT_LIMITS.maxTotalSize) {
          this.setError(`Adding "${file.name}" would exceed the total attachment limit of 8 MB.`);
          continue;
        }

        // Check for duplicates by name and size
        const isDuplicate = this.files.some(f => f.name === file.name && f.size === file.size);
        if (isDuplicate) {
          continue;
        }

        this.files.push(file);
      }

      this.render();
      if (typeof this.onChange === 'function') {
        this.onChange(this.files);
      }
    }

    removeFile(index) {
      this.files.splice(index, 1);
      this.setError('');
      this.render();
      if (typeof this.onChange === 'function') {
        this.onChange(this.files);
      }
    }

    clear() {
      this.files = [];
      this.setError('');
      this.render();
      if (typeof this.onChange === 'function') {
        this.onChange(this.files);
      }
    }

    render() {
      if (!this.listEl) return;
      this.listEl.innerHTML = '';

      this.files.forEach((file, index) => {
        const item = document.createElement('div');
        item.className = 'attachment-item';

        const isImg = file.type.startsWith('image/');
        const isVideo = file.type.startsWith('video/');

        const previewHtml = isImg
          ? `<img src="${URL.createObjectURL(file)}" alt="" class="attachment-item-thumb">`
          : `<div class="attachment-item-icon">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                ${isVideo ? '<polygon points="5 3 19 12 5 21 5 3"/>' : '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>'}
              </svg>
             </div>`;

        item.innerHTML = `
          <div class="attachment-item-info">
            ${previewHtml}
            <div class="attachment-item-text">
              <span class="attachment-item-name" title="${file.name}">${file.name}</span>
              <span class="attachment-item-size">${formatBytes(file.size)}</span>
            </div>
          </div>
          <button type="button" class="attachment-item-remove" aria-label="Remove ${file.name}">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        `;

        item.querySelector('.attachment-item-remove').addEventListener('click', () => {
          this.removeFile(index);
        });

        this.listEl.appendChild(item);
      });

      // Update storage meter
      const totalBytes = this.getTotalSize();
      const pct = Math.min(100, (totalBytes / ATTACHMENT_LIMITS.maxTotalSize) * 100);

      if (this.meterFillEl) {
        this.meterFillEl.style.width = `${pct}%`;
        this.meterFillEl.classList.toggle('warning', pct > 75 && pct <= 100);
        this.meterFillEl.classList.toggle('exceeded', pct > 100);
      }

      if (this.meterTextEl) {
        this.meterTextEl.textContent = `${this.files.length} / ${ATTACHMENT_LIMITS.maxFiles} files (${formatBytes(totalBytes)} of 8 MB)`;
      }
    }

    async getPayloadData() {
      const results = [];
      for (const file of this.files) {
        const item = await fileToBase64(file);
        results.push(item);
      }
      return results;
    }
  }

  /* ====================================================================
     CLIENT-SIDE FORM SUBMISSION CONTROLLER
     ==================================================================== */
  async function submitPayload(payload) {
    let result = null;
    let proxyError = null;

    // Strategy 1: Attempt through the serverless Netlify proxy (/api/submit-form)
    try {
      const proxyResp = await fetch(PROXY_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      if (proxyResp.ok) {
        result = await proxyResp.json();
        return { success: true, source: 'proxy', data: result };
      } else {
        proxyError = new Error(`Proxy responded with HTTP ${proxyResp.status}`);
      }
    } catch (err) {
      proxyError = err;
    }

    // Strategy 2: If proxy is not available (e.g. running on a local static server),
    // attempt direct submission to the Google Apps Script endpoint.
    try {
      const directResp = await fetch(DIRECT_APPS_SCRIPT_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      const text = await directResp.text();
      try {
        result = JSON.parse(text);
        return { success: true, source: 'direct', data: result };
      } catch {
        return { success: true, source: 'direct', data: { raw: text } };
      }
    } catch (directErr) {
      // Both proxy and direct attempt failed
      return {
        success: false,
        proxyError: proxyError ? proxyError.message : null,
        directError: directErr.message || String(directErr),
        isCorsRestriction: directErr.name === 'TypeError' || String(directErr).includes('fetch')
      };
    }
  }

  /* ====================================================================
     FORM VALIDATION HELPERS
     ==================================================================== */
  function validateField(inputEl, condition, errorMsg) {
    const formGroup = inputEl.closest('.form-group');
    const errorEl = formGroup ? formGroup.querySelector('.form-error-msg') : null;

    if (!condition) {
      inputEl.classList.add('is-invalid');
      inputEl.setAttribute('aria-invalid', 'true');
      if (formGroup) formGroup.classList.add('has-error');
      if (errorEl) {
        errorEl.textContent = errorMsg;
        errorEl.style.display = 'flex';
      }
      return false;
    } else {
      inputEl.classList.remove('is-invalid');
      inputEl.removeAttribute('aria-invalid');
      if (formGroup) formGroup.classList.remove('has-error');
      if (errorEl) {
        errorEl.style.display = 'none';
      }
      return true;
    }
  }

  function validateEmail(email) {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(String(email).trim());
  }

  /* ====================================================================
     STATUS BANNER RENDERER
     ==================================================================== */
  function renderStatus(bannerEl, type, options = {}) {
    if (!bannerEl) return;
    bannerEl.className = `form-status-banner show status-${type}`;

    if (type === 'test-mode') {
      const data = options.data || {};
      const prefillUrl = options.prefillUrl || '#';
      bannerEl.innerHTML = `
        <div class="form-status-header">
          <div class="form-status-icon">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
            </svg>
          </div>
          <div class="form-status-content">
            <h3 class="form-status-title">Backend Validation Succeeded (Test Mode Active)</h3>
            <p class="form-status-desc">
              Your submission passed all field validation and choice constraints. The Google Apps Script backend verified 
              <strong>${data.mappedFieldCount || 0} mapped fields</strong> matching the official Google Form structure.
            </p>
            <p class="form-status-desc" style="font-size:0.88rem;color:var(--text-muted);margin-bottom:8px;">
              <strong>Note:</strong> Because the backend service is currently deployed with <code>TEST_MODE: true</code>, 
              the response was constructed and verified without writing records to Google Forms or uploading files to Google Drive.
            </p>
            <div class="form-status-meta">
              <span class="form-status-pill badge-red">Form: ${data.formTitle || 'GameManor Form'}</span>
              <span class="form-status-pill badge-green">Validation: Passed</span>
              <span class="form-status-pill badge-red">Test Mode: Enabled</span>
              ${data.attachmentCountReceived ? `<span class="form-status-pill badge-green">Attachments Received: ${data.attachmentCountReceived}</span>` : ''}
            </div>
            <div class="form-status-actions">
              <a href="${prefillUrl}" target="_blank" rel="noopener" class="btn btn-secondary" style="font-size:0.88rem;padding:8px 16px;">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
                Open in Official Google Form (Prefilled)
              </a>
              <button type="button" class="btn btn-outline reset-form-btn" style="font-size:0.88rem;padding:8px 16px;">
                Clear &amp; Submit Another
              </button>
            </div>
          </div>
        </div>
      `;
    } else if (type === 'success') {
      bannerEl.innerHTML = `
        <div class="form-status-header">
          <div class="form-status-icon">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
              <polyline points="20 6 9 17 4 12"/>
            </svg>
          </div>
          <div class="form-status-content">
            <h3 class="form-status-title">Submission Successfully Received</h3>
            <p class="form-status-desc">
              Thank you for contacting GameManor! Your message has been recorded and our team has been notified.
            </p>
            <div class="form-status-actions">
              <button type="button" class="btn btn-secondary reset-form-btn" style="font-size:0.88rem;padding:8px 16px;">
                Submit Another Message
              </button>
            </div>
          </div>
        </div>
      `;
    } else if (type === 'error') {
      const prefillUrl = options.prefillUrl || '#';
      const isCors = options.isCors;
      bannerEl.innerHTML = `
        <div class="form-status-header">
          <div class="form-status-icon">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
              <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
          </div>
          <div class="form-status-content">
            <h3 class="form-status-title">${isCors ? 'Browser Cross-Origin Restriction' : 'Submission Encountered An Issue'}</h3>
            <p class="form-status-desc">
              ${isCors
                ? 'Direct browser submission to Google Apps Script was blocked by browser cross-origin preflight policies. When deployed on Netlify, submissions route seamlessly via the included serverless function (/api/submit-form).'
                : (options.message || 'An unexpected error occurred while communicating with the submission service.')}
            </p>
            <p class="form-status-desc" style="font-size:0.88rem;color:var(--text-muted);">
              Don't worry: your input has been saved. You can submit directly using our prefilled Google Form below without re-typing your answers.
            </p>
            <div class="form-status-actions">
              <a href="${prefillUrl}" target="_blank" rel="noopener" class="btn btn-primary" style="font-size:0.88rem;padding:8px 16px;">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
                Open Official Google Form (All Data Prefilled)
              </a>
              <a href="https://github.com/YOUR_GITHUB_USERNAME/gamemanor-launcher/issues" data-bind="issuesUrl" target="_blank" rel="noopener" class="btn btn-secondary" style="font-size:0.88rem;padding:8px 16px;">
                File on GitHub Issues
              </a>
            </div>
          </div>
        </div>
      `;
    }

    // Attach listener to reset button if present
    const resetBtn = bannerEl.querySelector('.reset-form-btn');
    if (resetBtn && options.onReset) {
      resetBtn.addEventListener('click', options.onReset);
    }

    bannerEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  function hideStatus(bannerEl) {
    if (bannerEl) {
      bannerEl.className = 'form-status-banner';
      bannerEl.innerHTML = '';
    }
  }

  /* ====================================================================
     INITIALIZE CONTACT FORM
     ==================================================================== */
  function initContactForm() {
    const formEl = document.getElementById('contactForm');
    const bannerEl = document.getElementById('contactStatusBanner');
    if (!formEl) return;

    const nameInput = formEl.querySelector('[name="fullName"]');
    const emailInput = formEl.querySelector('[name="emailAddress"]');
    const reasonSelect = formEl.querySelector('[name="reasonForContact"]');
    const subjectInput = formEl.querySelector('[name="subject"]');
    const messageInput = formEl.querySelector('[name="message"]');
    const versionInput = formEl.querySelector('[name="launcherVersion"]');
    const osSelect = formEl.querySelector('[name="operatingSystem"]');
    const hpInput = formEl.querySelector('[name="website"]');
    const submitBtn = formEl.querySelector('.form-submit-btn');

    // Real-time error clearance on input
    [nameInput, emailInput, reasonSelect, subjectInput, messageInput, osSelect].forEach(input => {
      if (input) {
        input.addEventListener('input', () => {
          input.classList.remove('is-invalid');
          const group = input.closest('.form-group');
          if (group) group.classList.remove('has-error');
        });
      }
    });

    formEl.addEventListener('submit', async (e) => {
      e.preventDefault();
      hideStatus(bannerEl);

      const fullName = nameInput ? nameInput.value.trim() : '';
      const email = emailInput ? emailInput.value.trim() : '';
      const reason = reasonSelect ? reasonSelect.value.trim() : '';
      const subject = subjectInput ? subjectInput.value.trim() : '';
      const message = messageInput ? messageInput.value.trim() : '';
      const version = versionInput ? versionInput.value.trim() : '1.0.0';
      const os = osSelect ? osSelect.value.trim() : '';
      const websiteHp = hpInput ? hpInput.value.trim() : '';

      // Validate inputs
      let isValid = true;
      let firstInvalid = null;

      if (!validateField(nameInput, fullName.length > 0, 'Please enter your full name.')) {
        isValid = false;
        if (!firstInvalid) firstInvalid = nameInput;
      }

      if (!validateField(emailInput, validateEmail(email), 'Please enter a valid email address.')) {
        isValid = false;
        if (!firstInvalid) firstInvalid = emailInput;
      }

      if (!validateField(reasonSelect, reason.length > 0, 'Please select a reason for contact.')) {
        isValid = false;
        if (!firstInvalid) firstInvalid = reasonSelect;
      }

      if (!validateField(subjectInput, subject.length > 0, 'Please enter a subject.')) {
        isValid = false;
        if (!firstInvalid) firstInvalid = subjectInput;
      }

      if (!validateField(messageInput, message.length > 0, 'Please enter your message.')) {
        isValid = false;
        if (!firstInvalid) firstInvalid = messageInput;
      }

      if (!validateField(osSelect, os.length > 0, 'Please select your operating system.')) {
        isValid = false;
        if (!firstInvalid) firstInvalid = osSelect;
      }

      if (!isValid) {
        if (firstInvalid) firstInvalid.focus();
        return;
      }

      // Build payload matching exact backend schema
      const payloadFields = {
        'Full Name': fullName,
        'Email Address': email,
        'Reason for Contact': reason,
        'Subject': subject,
        'Message': message,
        'GameManor Launcher Version': version || '1.0.0',
        'Operating System': os
      };

      const payload = {
        formType: 'contact',
        fields: payloadFields,
        website: websiteHp
      };

      const prefillUrl = buildPrefilledUrl('contact', payloadFields);

      // Set loading state
      if (submitBtn) {
        submitBtn.classList.add('is-submitting');
        const textSpan = submitBtn.querySelector('.btn-text');
        if (textSpan) textSpan.textContent = 'Validating Submission...';
      }

      try {
        const resp = await submitPayload(payload);

        if (resp.success && resp.data) {
          const data = resp.data;
          if (data.testMode && data.success) {
            renderStatus(bannerEl, 'test-mode', {
              data: data,
              prefillUrl: prefillUrl,
              onReset: () => {
                formEl.reset();
                hideStatus(bannerEl);
              }
            });
          } else if (data.success) {
            renderStatus(bannerEl, 'success', {
              data: data,
              onReset: () => {
                formEl.reset();
                hideStatus(bannerEl);
              }
            });
          } else {
            renderStatus(bannerEl, 'error', {
              message: data.message || 'Validation failed on the backend.',
              prefillUrl: prefillUrl
            });
          }
        } else {
          renderStatus(bannerEl, 'error', {
            isCors: resp.isCorsRestriction,
            message: resp.directError || resp.proxyError,
            prefillUrl: prefillUrl
          });
        }
      } catch (err) {
        renderStatus(bannerEl, 'error', {
          message: err.message,
          prefillUrl: prefillUrl
        });
      } finally {
        if (submitBtn) {
          submitBtn.classList.remove('is-submitting');
          const textSpan = submitBtn.querySelector('.btn-text');
          if (textSpan) textSpan.textContent = 'Submit Contact Request';
        }
      }
    });
  }

  /* ====================================================================
     INITIALIZE BUG REPORTS FORM
     ==================================================================== */
  function initBugForm() {
    const formEl = document.getElementById('bugReportForm');
    const bannerEl = document.getElementById('bugStatusBanner');
    if (!formEl) return;

    const nameInput = formEl.querySelector('[name="fullName"]');
    const emailInput = formEl.querySelector('[name="emailAddress"]');
    const titleInput = formEl.querySelector('[name="bugTitle"]');
    const categorySelect = formEl.querySelector('[name="bugCategory"]');
    const severitySelect = formEl.querySelector('[name="severity"]');
    const versionInput = formEl.querySelector('[name="launcherVersion"]');
    const winVersionSelect = formEl.querySelector('[name="windowsVersion"]');
    const featureInput = formEl.querySelector('[name="affectedFeature"]');
    const stepsInput = formEl.querySelector('[name="stepsToReproduce"]');
    const expectedInput = formEl.querySelector('[name="expectedBehavior"]');
    const actualInput = formEl.querySelector('[name="actualBehavior"]');
    const errorInput = formEl.querySelector('[name="errorMessage"]');
    const detailsInput = formEl.querySelector('[name="additionalDetails"]');
    const hpInput = formEl.querySelector('[name="website"]');
    const submitBtn = formEl.querySelector('.form-submit-btn');

    // Initialize attachment manager
    const attachmentContainer = formEl.querySelector('.attachment-section');
    let attachmentManager = null;
    if (attachmentContainer) {
      attachmentManager = new AttachmentManager(attachmentContainer);
      formEl._attachmentManager = attachmentManager;
      window._bugAttachmentManager = attachmentManager;
    }

    // Real-time error clearance
    [nameInput, emailInput, titleInput, categorySelect, severitySelect, winVersionSelect, featureInput, stepsInput, expectedInput, actualInput].forEach(input => {
      if (input) {
        input.addEventListener('input', () => {
          input.classList.remove('is-invalid');
          const group = input.closest('.form-group');
          if (group) group.classList.remove('has-error');
        });
      }
    });

    formEl.addEventListener('submit', async (e) => {
      e.preventDefault();
      hideStatus(bannerEl);

      const fullName = nameInput ? nameInput.value.trim() : '';
      const email = emailInput ? emailInput.value.trim() : '';
      const title = titleInput ? titleInput.value.trim() : '';
      const category = categorySelect ? categorySelect.value.trim() : '';
      const severity = severitySelect ? severitySelect.value.trim() : '';
      const version = versionInput ? versionInput.value.trim() : '1.0.0';
      const winVersion = winVersionSelect ? winVersionSelect.value.trim() : '';
      const feature = featureInput ? featureInput.value.trim() : '';
      const steps = stepsInput ? stepsInput.value.trim() : '';
      const expected = expectedInput ? expectedInput.value.trim() : '';
      const actual = actualInput ? actualInput.value.trim() : '';
      const errorMsg = errorInput ? errorInput.value.trim() : '';
      const details = detailsInput ? detailsInput.value.trim() : '';
      const websiteHp = hpInput ? hpInput.value.trim() : '';

      // Validate inputs
      let isValid = true;
      let firstInvalid = null;

      if (!validateField(nameInput, fullName.length > 0, 'Please enter your full name.')) {
        isValid = false;
        if (!firstInvalid) firstInvalid = nameInput;
      }

      if (!validateField(emailInput, validateEmail(email), 'Please enter a valid email address.')) {
        isValid = false;
        if (!firstInvalid) firstInvalid = emailInput;
      }

      if (!validateField(titleInput, title.length > 0, 'Please provide a clear bug title.')) {
        isValid = false;
        if (!firstInvalid) firstInvalid = titleInput;
      }

      if (!validateField(categorySelect, category.length > 0, 'Please select the affected category.')) {
        isValid = false;
        if (!firstInvalid) firstInvalid = categorySelect;
      }

      if (!validateField(severitySelect, severity.length > 0, 'Please select the issue severity.')) {
        isValid = false;
        if (!firstInvalid) firstInvalid = severitySelect;
      }

      if (!validateField(winVersionSelect, winVersion.length > 0, 'Please select your Windows version.')) {
        isValid = false;
        if (!firstInvalid) firstInvalid = winVersionSelect;
      }

      if (!validateField(featureInput, feature.length > 0, 'Please specify the affected game or feature.')) {
        isValid = false;
        if (!firstInvalid) firstInvalid = featureInput;
      }

      if (!validateField(stepsInput, steps.length > 0, 'Please describe steps to reproduce the issue.')) {
        isValid = false;
        if (!firstInvalid) firstInvalid = stepsInput;
      }

      if (!validateField(expectedInput, expected.length > 0, 'Please describe what should have happened.')) {
        isValid = false;
        if (!firstInvalid) firstInvalid = expectedInput;
      }

      if (!validateField(actualInput, actual.length > 0, 'Please describe what actually occurred.')) {
        isValid = false;
        if (!firstInvalid) firstInvalid = actualInput;
      }

      if (!isValid) {
        if (firstInvalid) firstInvalid.focus();
        return;
      }

      // Convert attachments to base64 if present
      let attachmentsPayload = [];
      if (attachmentManager && attachmentManager.files.length > 0) {
        attachmentsPayload = await attachmentManager.getPayloadData();
      }

      // Build payload matching exact backend schema
      const payloadFields = {
        'Full Name': fullName,
        'Email Address': email,
        'Bug Title': title,
        'Bug Category': category,
        'Severity': severity,
        'GameManor Launcher Version': version || '1.0.0',
        'Windows Version': winVersion,
        'Affected Game or Feature': feature,
        'Steps to Reproduce': steps,
        'Expected Behavior': expected,
        'Actual Behavior': actual,
        'Error Message or Exit Code': errorMsg,
        'Screenshot and Video Attachment Links': '',
        'Additional Details': details
      };

      const payload = {
        formType: 'bug',
        fields: payloadFields,
        attachments: attachmentsPayload,
        website: websiteHp
      };

      const prefillUrl = buildPrefilledUrl('bug', payloadFields);

      // Set loading state
      if (submitBtn) {
        submitBtn.classList.add('is-submitting');
        const textSpan = submitBtn.querySelector('.btn-text');
        if (textSpan) textSpan.textContent = 'Validating Bug Report...';
      }

      try {
        const resp = await submitPayload(payload);

        if (resp.success && resp.data) {
          const data = resp.data;
          if (data.testMode && data.success) {
            renderStatus(bannerEl, 'test-mode', {
              data: data,
              prefillUrl: prefillUrl,
              onReset: () => {
                formEl.reset();
                if (attachmentManager) attachmentManager.clear();
                hideStatus(bannerEl);
              }
            });
          } else if (data.success) {
            renderStatus(bannerEl, 'success', {
              data: data,
              onReset: () => {
                formEl.reset();
                if (attachmentManager) attachmentManager.clear();
                hideStatus(bannerEl);
              }
            });
          } else {
            renderStatus(bannerEl, 'error', {
              message: data.message || 'Validation failed on the backend.',
              prefillUrl: prefillUrl
            });
          }
        } else {
          renderStatus(bannerEl, 'error', {
            isCors: resp.isCorsRestriction,
            message: resp.directError || resp.proxyError,
            prefillUrl: prefillUrl
          });
        }
      } catch (err) {
        renderStatus(bannerEl, 'error', {
          message: err.message,
          prefillUrl: prefillUrl
        });
      } finally {
        if (submitBtn) {
          submitBtn.classList.remove('is-submitting');
          const textSpan = submitBtn.querySelector('.btn-text');
          if (textSpan) textSpan.textContent = 'Submit Bug Report';
        }
      }
    });
  }

  // Auto-init on DOMContentLoaded
  document.addEventListener('DOMContentLoaded', () => {
    initContactForm();
    initBugForm();
  });

  return {
    submitPayload,
    buildPrefilledUrl,
    ATTACHMENT_LIMITS,
    AttachmentManager
  };
})();
window.GAMEMANOR_FORMS = GAMEMANOR_FORMS;
