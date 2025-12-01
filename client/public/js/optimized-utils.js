// Optimized frontend utilities to reduce load times and server requests

class OptimizedUtils {
  constructor() {
    this.cache = new Map();
    this.requestQueue = new Map();
    this.debounceTimers = new Map();
  }

  // Debounced API calls to reduce server load
  debounce(func, delay, key) {
    if (this.debounceTimers.has(key)) {
      clearTimeout(this.debounceTimers.get(key));
    }

    const timer = setTimeout(() => {
      func();
      this.debounceTimers.delete(key);
    }, delay);

    this.debounceTimers.set(key, timer);
  }

  // Request deduplication to prevent duplicate API calls
  async makeRequest(url, options = {}, cacheKey = null) {
    const requestKey = `${options.method || 'GET'}_${url}`;
    
    // Check cache first
    if (cacheKey && this.cache.has(cacheKey)) {
      const cached = this.cache.get(cacheKey);
      if (Date.now() - cached.timestamp < (options.cacheTTL || 300000)) { // 5 min default
        return cached.data;
      }
    }

    // Check if request is already in progress
    if (this.requestQueue.has(requestKey)) {
      return this.requestQueue.get(requestKey);
    }

    // Make the request
    const requestPromise = fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers
      }
    }).then(async response => {
      const data = await response.json();
      
      // Cache successful responses
      if (response.ok && cacheKey) {
        this.cache.set(cacheKey, {
          data,
          timestamp: Date.now()
        });
      }

      // Remove from queue
      this.requestQueue.delete(requestKey);
      
      return { success: response.ok, data, status: response.status };
    }).catch(error => {
      this.requestQueue.delete(requestKey);
      throw error;
    });

    this.requestQueue.set(requestKey, requestPromise);
    return requestPromise;
  }

  // Optimized image loading with lazy loading and compression
  loadImage(src, options = {}) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      
      // Add loading optimization
      img.loading = 'lazy';
      img.decoding = 'async';
      
      img.onload = () => resolve(img);
      img.onerror = reject;
      
      // Add responsive image support
      if (options.sizes) {
        img.sizes = options.sizes;
      }
      
      img.src = src;
    });
  }

  // Batch DOM updates to reduce reflows
  batchDOMUpdates(updates) {
    requestAnimationFrame(() => {
      updates.forEach(update => update());
    });
  }

  // Optimized form validation with debouncing
  validateForm(formElement, validationRules, onValidation) {
    const inputs = formElement.querySelectorAll('input, select, textarea');
    
    inputs.forEach(input => {
      const validateInput = () => {
        const rule = validationRules[input.name];
        if (rule) {
          const isValid = rule.validator(input.value);
          const errorElement = formElement.querySelector(`[data-error="${input.name}"]`);
          
          this.batchDOMUpdates([
            () => {
              input.classList.toggle('border-red-500', !isValid);
              input.classList.toggle('border-green-500', isValid);
              
              if (errorElement) {
                errorElement.textContent = isValid ? '' : rule.message;
                errorElement.classList.toggle('hidden', isValid);
              }
            }
          ]);
          
          if (onValidation) onValidation(input.name, isValid);
        }
      };

      // Debounce validation
      input.addEventListener('input', () => {
        this.debounce(validateInput, 300, `validate_${input.name}`);
      });
    });
  }

  // Optimized pagination with virtual scrolling for large datasets
  createVirtualList(container, items, renderItem, itemHeight = 50) {
    const containerHeight = container.clientHeight;
    const visibleItems = Math.ceil(containerHeight / itemHeight) + 2; // Buffer
    
    let scrollTop = 0;
    let startIndex = 0;
    
    const updateList = () => {
      startIndex = Math.floor(scrollTop / itemHeight);
      const endIndex = Math.min(startIndex + visibleItems, items.length);
      
      // Clear container
      container.innerHTML = '';
      
      // Create spacer for items above viewport
      if (startIndex > 0) {
        const topSpacer = document.createElement('div');
        topSpacer.style.height = `${startIndex * itemHeight}px`;
        container.appendChild(topSpacer);
      }
      
      // Render visible items
      for (let i = startIndex; i < endIndex; i++) {
        const itemElement = renderItem(items[i], i);
        itemElement.style.height = `${itemHeight}px`;
        container.appendChild(itemElement);
      }
      
      // Create spacer for items below viewport
      const remainingItems = items.length - endIndex;
      if (remainingItems > 0) {
        const bottomSpacer = document.createElement('div');
        bottomSpacer.style.height = `${remainingItems * itemHeight}px`;
        container.appendChild(bottomSpacer);
      }
    };
    
    container.addEventListener('scroll', () => {
      scrollTop = container.scrollTop;
      requestAnimationFrame(updateList);
    });
    
    updateList();
  }

  // Optimized search with debouncing and caching
  createOptimizedSearch(searchInput, searchFunction, options = {}) {
    const { delay = 300, minLength = 2, cacheResults = true } = options;
    const searchCache = new Map();
    
    searchInput.addEventListener('input', (e) => {
      const query = e.target.value.trim();
      
      if (query.length < minLength) {
        return;
      }
      
      this.debounce(async () => {
        // Check cache first
        if (cacheResults && searchCache.has(query)) {
          const results = searchCache.get(query);
          searchFunction(results, query);
          return;
        }
        
        try {
          const results = await searchFunction(query);
          
          // Cache results
          if (cacheResults) {
            searchCache.set(query, results);
          }
          
        } catch (error) {
          console.error('Search error:', error);
        }
      }, delay, `search_${searchInput.id}`);
    });
  }

  // Optimized data table with sorting and filtering
  createDataTable(tableElement, data, columns, options = {}) {
    const { pageSize = 10, sortable = true, filterable = true } = options;
    
    let currentData = [...data];
    let currentPage = 1;
    let sortColumn = null;
    let sortDirection = 'asc';
    let filters = {};
    
    const renderTable = () => {
      // Apply filters
      let filteredData = currentData.filter(row => {
        return Object.keys(filters).every(key => {
          const filterValue = filters[key].toLowerCase();
          const cellValue = String(row[key]).toLowerCase();
          return cellValue.includes(filterValue);
        });
      });
      
      // Apply sorting
      if (sortColumn) {
        filteredData.sort((a, b) => {
          const aVal = a[sortColumn];
          const bVal = b[sortColumn];
          const comparison = aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
          return sortDirection === 'asc' ? comparison : -comparison;
        });
      }
      
      // Pagination
      const startIndex = (currentPage - 1) * pageSize;
      const endIndex = startIndex + pageSize;
      const pageData = filteredData.slice(startIndex, endIndex);
      
      // Render table
      this.batchDOMUpdates([
        () => {
          tableElement.innerHTML = `
            <thead>
              <tr>
                ${columns.map(col => `
                  <th class="px-4 py-2 text-left ${sortable ? 'cursor-pointer hover:bg-gray-100' : ''}" 
                      data-column="${col.key}">
                    ${col.label}
                    ${sortColumn === col.key ? (sortDirection === 'asc' ? '↑' : '↓') : ''}
                  </th>
                `).join('')}
              </tr>
            </thead>
            <tbody>
              ${pageData.map(row => `
                <tr class="border-t hover:bg-gray-50">
                  ${columns.map(col => `
                    <td class="px-4 py-2">
                      ${col.render ? col.render(row[col.key], row) : row[col.key]}
                    </td>
                  `).join('')}
                </tr>
              `).join('')}
            </tbody>
          `;
        }
      ]);
    };
    
    // Add event listeners
    if (sortable) {
      tableElement.addEventListener('click', (e) => {
        const th = e.target.closest('th[data-column]');
        if (th) {
          const column = th.dataset.column;
          if (sortColumn === column) {
            sortDirection = sortDirection === 'asc' ? 'desc' : 'asc';
          } else {
            sortColumn = column;
            sortDirection = 'asc';
          }
          renderTable();
        }
      });
    }
    
    renderTable();
    
    return {
      updateData: (newData) => {
        currentData = [...newData];
        renderTable();
      },
      setFilter: (column, value) => {
        if (value) {
          filters[column] = value;
        } else {
          delete filters[column];
        }
        currentPage = 1;
        renderTable();
      },
      setPage: (page) => {
        currentPage = page;
        renderTable();
      }
    };
  }

  // Clear cache to free memory
  clearCache() {
    this.cache.clear();
  }

  // Get cache statistics
  getCacheStats() {
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys())
    };
  }
}

// Global instance
window.optimizedUtils = new OptimizedUtils();

// Utility functions for common operations
window.debounce = (func, delay) => {
  let timeoutId;
  return (...args) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => func.apply(null, args), delay);
  };
};

window.throttle = (func, limit) => {
  let inThrottle;
  return (...args) => {
    if (!inThrottle) {
      func.apply(null, args);
      inThrottle = true;
      setTimeout(() => inThrottle = false, limit);
    }
  };
};

// Optimized event delegation
window.delegate = (parent, selector, event, handler) => {
  parent.addEventListener(event, (e) => {
    if (e.target.matches(selector)) {
      handler(e);
    }
  });
};