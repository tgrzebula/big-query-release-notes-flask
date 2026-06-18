// State Management
let appState = {
    releases: [],
    meta: {
        title: 'BigQuery Release Notes',
        updated: '',
        lastCached: ''
    },
    filters: {
        category: 'all',
        search: '',
        bookmarkedOnly: false
    },
    bookmarks: new Set()
};

// SVG Icons Constants for dynamically generated UI components
const ICONS = {
    bookmark: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="icon"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"></path></svg>`,
    bookmarkFilled: `<svg viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="2" class="icon"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"></path></svg>`,
    share: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="icon"><circle cx="18" cy="5" r="3"></circle><circle cx="6" cy="12" r="3"></circle><circle cx="18" cy="19" r="3"></circle><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"></line><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"></line></svg>`,
    check: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="icon"><polyline points="20 6 9 17 4 12"></polyline></svg>`,
    link: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="icon"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path></svg>`,
    twitter: `<svg viewBox="0 0 24 24" fill="currentColor" class="icon"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>`
};

// Initialize Application
document.addEventListener('DOMContentLoaded', () => {
    initTheme();
    loadBookmarks();
    fetchReleases();
    setupEventListeners();
    setupKeyboardShortcuts();
    setupScrollToTop();
});

// Theme Management
function initTheme() {
    const savedTheme = localStorage.getItem('theme') || 'dark';
    document.documentElement.setAttribute('data-theme', savedTheme);
    updateThemeUI(savedTheme);
}

function updateThemeUI(theme) {
    const themeText = document.querySelector('.theme-text');
    if (theme === 'dark') {
        themeText.textContent = 'Dark Mode';
    } else {
        themeText.textContent = 'Light Mode';
    }
}

function toggleTheme() {
    const currentTheme = document.documentElement.getAttribute('data-theme');
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);
    updateThemeUI(newTheme);
    showToast('Theme updated successfully', 'info');
}

// Load and Save Bookmarks
function loadBookmarks() {
    const stored = localStorage.getItem('bq_bookmarks');
    if (stored) {
        try {
            const list = JSON.parse(stored);
            appState.bookmarks = new Set(list);
            updateBookmarkCount();
        } catch (e) {
            console.error('Error parsing bookmarks', e);
        }
    }
}

function saveBookmarks() {
    const list = Array.from(appState.bookmarks);
    localStorage.setItem('bq_bookmarks', JSON.stringify(list));
    updateBookmarkCount();
}

function updateBookmarkCount() {
    const countEl = document.getElementById('bookmark-count');
    if (countEl) {
        countEl.textContent = appState.bookmarks.size;
    }
}

function toggleBookmark(itemId) {
    if (appState.bookmarks.has(itemId)) {
        appState.bookmarks.delete(itemId);
        showToast('Release note removed from bookmarks', 'info');
    } else {
        appState.bookmarks.add(itemId);
        showToast('Release note bookmarked!', 'success');
    }
    saveBookmarks();
    
    // Update button states on screen
    const btns = document.querySelectorAll(`[data-bookmark-id="${itemId}"]`);
    btns.forEach(btn => {
        btn.innerHTML = appState.bookmarks.has(itemId) ? ICONS.bookmarkFilled : ICONS.bookmark;
        btn.classList.toggle('active', appState.bookmarks.has(itemId));
    });

    // If currently viewing only bookmarks, re-filter screen
    if (appState.filters.bookmarkedOnly) {
        filterAndRender();
    }
}

// Fetch Data from Flask backend
async function fetchReleases(force = false) {
    showLoader(true);
    const refreshBtn = document.getElementById('btn-refresh');
    const refreshIcon = refreshBtn.querySelector('.icon-refresh');
    
    if (force) {
        refreshIcon.classList.add('spinning');
        refreshBtn.disabled = true;
    }

    try {
        const url = '/api/releases';
        const response = await fetch(url);
        
        if (!response.ok) {
            throw new Error(`Server responded with ${response.status}`);
        }
        
        const data = await response.json();
        
        appState.releases = data.entries;
        appState.meta.title = data.feed_title;
        appState.meta.updated = data.feed_updated;
        appState.meta.lastCached = data.last_cached;
        
        updateMetaUI();
        calculateAndAnimateStats();
        filterAndRender();
        
        if (force) {
            showToast('Feed reloaded successfully!', 'success');
        }
        
        // Handle direct deep linking after data loaded
        setTimeout(handleHashLink, 300);
        
    } catch (error) {
        console.error('Error fetching release notes:', error);
        showToast(`Error: ${error.message || 'Failed to load releases'}`, 'error');
        
        // Keep showing empty state if fetch failed and no data
        if (appState.releases.length === 0) {
            document.getElementById('timeline-container').style.display = 'none';
            document.getElementById('empty-state').style.display = 'flex';
        }
    } finally {
        showLoader(false);
        if (force) {
            refreshIcon.classList.remove('spinning');
            refreshBtn.disabled = false;
        }
    }
}

function showLoader(show) {
    const skeleton = document.getElementById('skeleton-loader');
    const timeline = document.getElementById('timeline-container');
    const empty = document.getElementById('empty-state');
    
    if (show) {
        skeleton.style.display = 'flex';
        timeline.style.display = 'none';
        empty.style.display = 'none';
    } else {
        skeleton.style.display = 'none';
    }
}

function updateMetaUI() {
    document.getElementById('sync-time').textContent = formatSyncTime(appState.meta.lastCached);
    document.getElementById('feed-updated').textContent = formatDate(appState.meta.updated);
}

// Stats Counting Animation
function calculateAndAnimateStats() {
    let stats = {
        Feature: 0,
        Announcement: 0,
        Change: 0,
        Breaking: 0,
        Issue: 0
    };
    
    appState.releases.forEach(entry => {
        entry.items.forEach(item => {
            if (stats[item.type] !== undefined) {
                stats[item.type]++;
            } else if (item.type === 'Fixed' || item.type === 'Resolved') {
                stats.Issue++;
            } else if (item.type === 'Deprecated') {
                stats.Change++;
            }
        });
    });
    
    animateNumber('stat-features', stats.Feature);
    animateNumber('stat-announcements', stats.Announcement);
    animateNumber('stat-changes', stats.Change);
    animateNumber('stat-breaking', stats.Breaking);
}

function animateNumber(id, target) {
    const el = document.getElementById(id);
    if (!el) return;
    
    let current = 0;
    const duration = 800; // ms
    const stepTime = Math.max(Math.floor(duration / (target || 1)), 15);
    
    const timer = setInterval(() => {
        if (current >= target) {
            el.textContent = target;
            clearInterval(timer);
        } else {
            current += Math.ceil((target - current) / 6) || 1;
            if (current >= target) current = target;
            el.textContent = current;
        }
    }, stepTime);
}

// Filtering and Searching logic
function filterAndRender() {
    const timeline = document.getElementById('timeline-container');
    const emptyState = document.getElementById('empty-state');
    const filterSummary = document.getElementById('filter-summary');
    
    timeline.innerHTML = '';
    
    let filteredCount = 0;
    let totalItems = 0;
    
    // Determine active filters
    const activeCategory = appState.filters.category;
    const searchQuery = appState.filters.search.toLowerCase().trim();
    const bookmarkedOnly = appState.filters.bookmarkedOnly;
    
    // Show active filter bar if search or bookmarks filters are active
    if (activeCategory !== 'all' || searchQuery !== '' || bookmarkedOnly) {
        filterSummary.style.display = 'flex';
        
        let summaryText = 'Active filters: ';
        let conditions = [];
        if (activeCategory !== 'all') conditions.push(`Type: <strong>${activeCategory}</strong>`);
        if (searchQuery !== '') conditions.push(`Search: "<strong>${escapeHtml(searchQuery)}</strong>"`);
        if (bookmarkedOnly) conditions.push('<strong>Saved notes only</strong>');
        
        filterSummary.querySelector('.summary-text').innerHTML = summaryText + conditions.join(' + ');
    } else {
        filterSummary.style.display = 'none';
    }

    appState.releases.forEach(entry => {
        // Filter items in this entry
        let matchingItems = entry.items.filter(item => {
            totalItems++;
            
            // Check Category filter
            if (activeCategory !== 'all') {
                let mappedType = item.type;
                if ((item.type === 'Fixed' || item.type === 'Resolved') && activeCategory === 'Issue') mappedType = 'Issue';
                if (item.type === 'Deprecated' && activeCategory === 'Change') mappedType = 'Change';
                if (mappedType !== activeCategory) return false;
            }
            
            // Check Bookmark filter
            const noteId = `${entry.anchor_id}_${item.type}`;
            if (bookmarkedOnly && !appState.bookmarks.has(noteId)) {
                return false;
            }
            
            // Check Search filter
            if (searchQuery !== '') {
                const itemContentText = stripHtml(item.content).toLowerCase();
                const itemTypeText = item.type.toLowerCase();
                const entryDateText = entry.date.toLowerCase();
                
                const matchesSearch = itemContentText.includes(searchQuery) || 
                                      itemTypeText.includes(searchQuery) || 
                                      entryDateText.includes(searchQuery);
                if (!matchesSearch) return false;
            }
            
            return true;
        });
        
        if (matchingItems.length > 0) {
            filteredCount += matchingItems.length;
            renderEntry(timeline, entry, matchingItems, searchQuery);
        }
    });

    if (filteredCount > 0) {
        timeline.style.display = 'block';
        emptyState.style.display = 'none';
    } else {
        timeline.style.display = 'none';
        emptyState.style.display = 'flex';
    }
}

// Render a single release date block
function renderEntry(container, entry, items, searchQuery) {
    const dayDiv = document.createElement('div');
    dayDiv.className = 'timeline-day';
    dayDiv.id = entry.anchor_id;
    
    // Days ago string calculation
    const daysAgo = calculateDaysAgo(entry.updated);
    const daysAgoText = daysAgo === 0 ? 'Today' : daysAgo === 1 ? 'Yesterday' : `${daysAgo} days ago`;

    let html = `
        <div class="timeline-marker"></div>
        <div class="day-header">
            <h2 class="day-title">${highlightQueryText(entry.date, searchQuery)}</h2>
            <span class="day-ago-badge">${daysAgoText}</span>
        </div>
        <div class="day-cards">
    `;

    items.forEach(item => {
        const noteId = `${entry.anchor_id}_${item.type}`;
        const isBookmarked = appState.bookmarks.has(noteId);
        
        // Dynamic badge style
        const typeClass = getBadgeClass(item.type);
        
        html += `
            <div class="note-card ${item.type}">
                <div class="card-header">
                    <div class="badge-wrapper">
                        <span class="type-badge ${typeClass}">${item.type}</span>
                    </div>
                    <div class="card-actions">
                        <button class="btn-action-icon btn-tweet" data-anchor-id="${entry.anchor_id}" data-date="${entry.date}" data-type="${item.type}" title="Tweet about this update">
                            ${ICONS.twitter}
                        </button>
                        <button class="btn-action-icon btn-share" data-share-id="${entry.anchor_id}" title="Copy link to this release note">
                            ${ICONS.share}
                        </button>
                        <button class="btn-action-icon btn-bookmark ${isBookmarked ? 'active' : ''}" data-bookmark-id="${noteId}" title="Save release note">
                            ${isBookmarked ? ICONS.bookmarkFilled : ICONS.bookmark}
                        </button>
                    </div>
                </div>
                <div class="card-content">
                    ${highlightHtmlContent(item.content, searchQuery)}
                </div>
            </div>
        `;
    });

    html += `</div>`;
    dayDiv.innerHTML = html;
    container.appendChild(dayDiv);

    // Setup action buttons click handlers inside cards
    dayDiv.querySelectorAll('.btn-bookmark').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            toggleBookmark(btn.dataset.bookmarkId);
        });
    });

    dayDiv.querySelectorAll('.btn-share').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            shareLink(btn.dataset.shareId);
        });
    });

    dayDiv.querySelectorAll('.btn-tweet').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const card = btn.closest('.note-card');
            const content = card.querySelector('.card-content').innerHTML;
            tweetRelease(btn.dataset.anchorId, btn.dataset.date, btn.dataset.type, content);
        });
    });

    // Add copy button code wrapper triggers
    dayDiv.querySelectorAll('.card-content pre').forEach(pre => {
        wrapPreCode(pre);
    });
}

function getBadgeClass(type) {
    switch(type) {
        case 'Feature': return 'feature';
        case 'Announcement': return 'announcement';
        case 'Change': return 'change';
        case 'Deprecated': return 'change';
        case 'Breaking': return 'breaking';
        case 'Issue': return 'issue';
        case 'Fixed': return 'issue';
        case 'Resolved': return 'issue';
        default: return 'announcement';
    }
}

// Wrap code tags with copy-to-clipboard wrapper
function wrapPreCode(pre) {
    if (pre.parentNode.classList.contains('code-wrapper')) return;
    
    const wrapper = document.createElement('div');
    wrapper.className = 'code-wrapper';
    pre.parentNode.insertBefore(wrapper, pre);
    wrapper.appendChild(pre);
    
    const copyBtn = document.createElement('button');
    copyBtn.className = 'copy-code-btn';
    copyBtn.textContent = 'Copy';
    wrapper.appendChild(copyBtn);
    
    copyBtn.addEventListener('click', () => {
        const codeText = pre.querySelector('code')?.textContent || pre.textContent;
        navigator.clipboard.writeText(codeText).then(() => {
            copyBtn.textContent = 'Copied!';
            showToast('Code copied to clipboard', 'success');
            setTimeout(() => {
                copyBtn.textContent = 'Copy';
            }, 2000);
        }).catch(err => {
            console.error('Failed to copy code', err);
            showToast('Failed to copy code', 'error');
        });
    });
}

// Highlight functions
function highlightQueryText(text, query) {
    if (!query) return text;
    const regex = new RegExp(`(${escapeRegex(query)})`, 'gi');
    return text.replace(regex, '<mark class="search-highlight">$1</mark>');
}

function highlightHtmlContent(htmlContent, query) {
    if (!query) return htmlContent;
    
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = htmlContent;
    
    highlightNodes(tempDiv, query);
    
    return tempDiv.innerHTML;
}

function highlightNodes(element, query) {
    const children = Array.from(element.childNodes);
    const regex = new RegExp(`(${escapeRegex(query)})`, 'gi');
    
    children.forEach(child => {
        if (child.nodeType === Node.TEXT_NODE) {
            const text = child.nodeValue;
            if (regex.test(text)) {
                const span = document.createElement('span');
                span.innerHTML = text.replace(regex, '<mark class="search-highlight">$1</mark>');
                element.replaceChild(span, child);
            }
        } else if (child.nodeType === Node.ELEMENT_NODE) {
            // Avoid highlighting inside code or style tags
            if (child.tagName !== 'CODE' && child.tagName !== 'PRE' && child.tagName !== 'A') {
                highlightNodes(child, query);
            }
        }
    });
}

// Keyboard shortcuts
function setupKeyboardShortcuts() {
    document.addEventListener('keydown', (e) => {
        // Press "/" to focus search input
        if (e.key === '/' && document.activeElement.tagName !== 'INPUT' && document.activeElement.tagName !== 'TEXTAREA') {
            e.preventDefault();
            const search = document.getElementById('search-input');
            search.focus();
            search.select();
        }
        
        // Command/Ctrl + K shortcut to focus search
        if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
            e.preventDefault();
            const search = document.getElementById('search-input');
            search.focus();
            search.select();
        }

        // Escape to clear search and blur
        if (e.key === 'Escape' && document.activeElement === document.getElementById('search-input')) {
            const search = document.getElementById('search-input');
            search.value = '';
            appState.filters.search = '';
            document.getElementById('btn-clear-search').style.display = 'none';
            search.blur();
            filterAndRender();
        }
    });
}

// Deep link hash handler
function handleHashLink() {
    const hash = window.location.hash;
    if (hash) {
        const targetId = hash.substring(1);
        const targetElement = document.getElementById(targetId);
        
        if (targetElement) {
            targetElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
            
            const cards = targetElement.querySelectorAll('.note-card');
            cards.forEach(card => {
                card.style.boxShadow = '0 0 20px rgba(59, 130, 246, 0.4)';
                card.style.borderColor = 'var(--primary)';
                
                setTimeout(() => {
                    card.style.boxShadow = '';
                    card.style.borderColor = '';
                }, 3000);
            });
        }
    }
}

// Copy sharing link
function shareLink(anchorId) {
    const link = `${window.location.origin}${window.location.pathname}#${anchorId}`;
    navigator.clipboard.writeText(link).then(() => {
        showToast('Deep link copied to clipboard!', 'success');
        window.location.hash = anchorId;
    }).catch(err => {
        console.error('Failed to copy sharing link', err);
        showToast('Failed to copy sharing link', 'error');
    });
}

// Share on Twitter/X
function tweetRelease(anchorId, date, type, contentHtml) {
    const plainText = stripHtml(contentHtml).trim();
    const link = `${window.location.origin}${window.location.pathname}#${anchorId}`;
    
    const prefix = `BigQuery Update (${date}) [${type}]:\n\n`;
    const suffix = `\n\nDetails: `;
    
    // Twitter handles URLs as 23 characters.
    const urlLength = 23;
    const maxTextLength = 280 - urlLength - prefix.length - suffix.length;
    
    let text = plainText;
    if (plainText.length > maxTextLength) {
        text = plainText.substring(0, maxTextLength - 3) + '...';
    }
    
    const tweetText = `${prefix}${text}${suffix}`;
    const tweetUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(tweetText)}&url=${encodeURIComponent(link)}`;
    
    window.open(tweetUrl, '_blank');
}

// Setup Event Listeners
function setupEventListeners() {
    // Refresh Button Click
    document.getElementById('btn-refresh').addEventListener('click', () => {
        fetchReleases(true);
    });

    // Theme Toggle Click
    document.getElementById('theme-toggle').addEventListener('click', toggleTheme);

    // Search Input Listener
    const searchInput = document.getElementById('search-input');
    const clearSearchBtn = document.getElementById('btn-clear-search');
    
    searchInput.addEventListener('input', (e) => {
        const query = e.target.value;
        appState.filters.search = query;
        
        if (query.length > 0) {
            clearSearchBtn.style.display = 'flex';
        } else {
            clearSearchBtn.style.display = 'none';
        }
        
        filterAndRender();
    });

    // Clear search button
    clearSearchBtn.addEventListener('click', () => {
        searchInput.value = '';
        appState.filters.search = '';
        clearSearchBtn.style.display = 'none';
        searchInput.focus();
        filterAndRender();
    });

    // Category Filter Chips
    const filterGroup = document.getElementById('type-filter-group');
    filterGroup.addEventListener('click', (e) => {
        const chip = e.target.closest('.filter-chip');
        if (!chip) return;

        // Toggle Active
        filterGroup.querySelectorAll('.filter-chip').forEach(c => c.classList.remove('active'));
        chip.classList.add('active');

        appState.filters.category = chip.dataset.filter;
        filterAndRender();
    });

    // Sidebar Category Cards trigger same filters!
    const statsCards = document.querySelectorAll('.stat-card');
    statsCards.forEach(card => {
        card.addEventListener('click', () => {
            const filterType = card.dataset.filterType;
            
            // Activate filter chip
            const chip = document.querySelector(`.filter-chip[data-filter="${filterType}"]`);
            if (chip) {
                filterGroup.querySelectorAll('.filter-chip').forEach(c => c.classList.remove('active'));
                chip.classList.add('active');
                appState.filters.category = filterType;
                filterAndRender();
                
                // Scroll to timeline controls in mobile views
                if (window.innerWidth <= 1024) {
                    document.querySelector('.controls-panel').scrollIntoView({ behavior: 'smooth' });
                }
            }
        });
    });

    // Bookmark Toggle Filter Button
    const btnBookmarked = document.getElementById('btn-bookmarked');
    btnBookmarked.addEventListener('click', () => {
        appState.filters.bookmarkedOnly = !appState.filters.bookmarkedOnly;
        btnBookmarked.classList.toggle('active', appState.filters.bookmarkedOnly);
        
        if (appState.filters.bookmarkedOnly) {
            btnBookmarked.style.backgroundColor = 'var(--primary-glow)';
            btnBookmarked.style.borderColor = 'var(--primary)';
            btnBookmarked.style.color = 'var(--primary)';
        } else {
            btnBookmarked.style.backgroundColor = '';
            btnBookmarked.style.borderColor = '';
            btnBookmarked.style.color = '';
        }
        filterAndRender();
    });

    // Reset buttons inside empty state or filter summary
    document.getElementById('btn-reset-filters').addEventListener('click', resetAllFilters);
    document.getElementById('btn-clear-all').addEventListener('click', resetAllFilters);
}

function resetAllFilters() {
    appState.filters.category = 'all';
    appState.filters.search = '';
    appState.filters.bookmarkedOnly = false;
    
    // Reset inputs
    document.getElementById('search-input').value = '';
    document.getElementById('btn-clear-search').style.display = 'none';
    
    // Reset active chip
    const filterGroup = document.getElementById('type-filter-group');
    filterGroup.querySelectorAll('.filter-chip').forEach(c => c.classList.remove('active'));
    filterGroup.querySelector('[data-filter="all"]').classList.add('active');
    
    // Reset bookmarks toggle button styling
    const btnBookmarked = document.getElementById('btn-bookmarked');
    btnBookmarked.classList.remove('active');
    btnBookmarked.style.backgroundColor = '';
    btnBookmarked.style.borderColor = '';
    btnBookmarked.style.color = '';
    
    filterAndRender();
}

// Scroll to Top & Scroll Progress Ring Setup
function setupScrollToTop() {
    const scrollBtn = document.getElementById('scroll-to-top');
    const circle = document.querySelector('.progress-ring__circle');
    const radius = circle.r.baseVal.value;
    const circumference = 2 * Math.PI * radius;
    
    circle.style.strokeDasharray = `${circumference} ${circumference}`;
    circle.style.strokeDashoffset = circumference;
    
    const mainContainer = document.querySelector('.app-main');
    
    const scrollContainer = window.innerWidth > 1024 ? mainContainer : window;
    
    const updateProgress = () => {
        const scrollTop = window.innerWidth > 1024 ? mainContainer.scrollTop : window.scrollY;
        const scrollHeight = window.innerWidth > 1024 ? 
                             mainContainer.scrollHeight - mainContainer.clientHeight : 
                             document.documentElement.scrollHeight - window.innerHeight;
                             
        if (scrollTop > 300) {
            scrollBtn.classList.add('visible');
        } else {
            scrollBtn.classList.remove('visible');
        }
        
        if (scrollHeight > 0) {
            const progress = scrollTop / scrollHeight;
            const offset = circumference - (progress * circumference);
            circle.style.strokeDashoffset = offset;
        }
    };
    
    if (window.innerWidth > 1024) {
        mainContainer.addEventListener('scroll', updateProgress);
    } else {
        window.addEventListener('scroll', updateProgress);
    }
    
    window.addEventListener('resize', () => {
        if (window.innerWidth > 1024) {
            window.removeEventListener('scroll', updateProgress);
            mainContainer.addEventListener('scroll', updateProgress);
        } else {
            mainContainer.removeEventListener('scroll', updateProgress);
            window.addEventListener('scroll', updateProgress);
        }
    });

    scrollBtn.addEventListener('click', () => {
        if (window.innerWidth > 1024) {
            mainContainer.scrollTo({ top: 0, behavior: 'smooth' });
        } else {
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }
    });
}

// Toast Notifications System
function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    
    let iconSvg = '';
    if (type === 'success') {
        iconSvg = ICONS.check;
    } else if (type === 'error') {
        iconSvg = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="icon"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>`;
    } else {
        iconSvg = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="icon"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>`;
    }
    
    toast.innerHTML = `
        <div class="toast-icon">${iconSvg}</div>
        <div class="toast-text">${message}</div>
    `;
    
    container.appendChild(toast);
    
    setTimeout(() => {
        toast.classList.add('fade-out');
        toast.addEventListener('animationend', () => {
            toast.remove();
        });
    }, 3500);
}

// Helper Utilities
function calculateDaysAgo(dateStr) {
    if (!dateStr) return '';
    try {
        const cleanDateStr = dateStr.includes('T') ? dateStr.split('T')[0] : dateStr;
        const entryDate = new Date(cleanDateStr);
        const today = new Date();
        
        entryDate.setHours(0,0,0,0);
        today.setHours(0,0,0,0);
        
        const diffTime = today - entryDate;
        const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
        return Math.max(0, diffDays);
    } catch(e) {
        return '';
    }
}

function formatDate(dateStr) {
    if (!dateStr) return 'Unknown';
    try {
        const d = new Date(dateStr);
        if (isNaN(d.getTime())) return dateStr;
        return d.toLocaleDateString('en-US', { 
            year: 'numeric', 
            month: 'short', 
            day: 'numeric' 
        });
    } catch (e) {
        return dateStr;
    }
}

function formatSyncTime(cachedTimeStr) {
    if (!cachedTimeStr) return 'Never';
    try {
        const parts = cachedTimeStr.split(' ');
        const dateParts = parts[0].split('-');
        const timeParts = parts[1].split(':');
        
        const d = new Date(dateParts[0], dateParts[1] - 1, dateParts[2], timeParts[0], timeParts[1], timeParts[2]);
        return d.toLocaleTimeString('en-US', { 
            hour: '2-digit', 
            minute: '2-digit', 
            second: '2-digit' 
        });
    } catch(e) {
        return cachedTimeStr;
    }
}

function stripHtml(html) {
    const tmp = document.createElement('div');
    tmp.innerHTML = html;
    return tmp.textContent || tmp.innerText || '';
}

function escapeHtml(text) {
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    };
    return text.replace(/[&<>"']/g, function(m) { return map[m]; });
}

function escapeRegex(string) {
    return string.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
}
