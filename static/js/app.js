document.addEventListener('DOMContentLoaded', () => {
    // Elements
    const dom = {
        chatArea: document.getElementById('chatArea'),
        chatHistory: document.getElementById('chatHistory'),
        userInput: document.getElementById('userInput'),
        sendBtn: document.getElementById('sendBtn'),
        fileUpload: document.getElementById('fileUpload'),
        fileTag: document.getElementById('fileTag'),
        fileName: document.getElementById('fileName'),
        removeFile: document.getElementById('removeFile'),
        editorPanel: document.getElementById('editorPanel'),
        openEditorBtn: document.getElementById('openEditorBtn'),
        closePanelBtn: document.getElementById('closePanelBtn'),
        editor: document.getElementById('editor'),
        generateBtn: document.getElementById('generateBtn'),
        downloadBtn: document.getElementById('downloadBtn'),
        expandBtn: document.getElementById('expandBtn'),
        editSettingsBtn: document.getElementById('editSettingsBtn'),
        stopBtn: document.getElementById('stopBtn'),
        statusText: document.getElementById('statusText'),
        welcomeMsg: document.querySelector('.welcome-message'),
        optionsSection: document.getElementById('optionsSection'),
        optionsContainer: document.getElementById('optionsContainer'),
        optionsToggle: document.getElementById('optionsToggle'),
        exportPromptBtn: document.getElementById('exportPromptBtn')
    };

    let state = {
        fileContent: null,
        writingOptions: [],
        selectedOptions: {},
        originalPrompt: null,  // Store original prompt for editing
        abortController: null  // For cancelling fetch requests
    };

    // Auto-resize textarea
    dom.userInput.addEventListener('input', function () {
        this.style.height = 'auto';
        this.style.height = Math.min(this.scrollHeight, 150) + 'px';
    });

    // File upload
    document.querySelector('.upload-label').addEventListener('click', () => dom.fileUpload.click());

    dom.fileUpload.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        dom.fileName.textContent = file.name;
        dom.fileTag.classList.remove('hidden');
        dom.statusText.textContent = '上传中...';

        const formData = new FormData();
        formData.append('file', file);

        try {
            const res = await fetch('/api/upload', { method: 'POST', body: formData });
            const data = await res.json();
            if (res.ok) {
                state.fileContent = data.content_preview;
                dom.statusText.textContent = '就绪';
            } else {
                alert('上传失败: ' + data.detail);
                clearFile();
            }
        } catch (err) {
            console.error(err);
            clearFile();
        }
    });

    dom.removeFile.addEventListener('click', clearFile);

    function clearFile() {
        dom.fileUpload.value = '';
        state.fileContent = null;
        dom.fileTag.classList.add('hidden');
        dom.statusText.textContent = '就绪';
    }

    // Send message
    dom.sendBtn.addEventListener('click', sendMessage);
    dom.userInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    });

    async function sendMessage() {
        const text = dom.userInput.value.trim();
        if (!text && !state.fileContent) return;

        // Hide welcome message
        if (dom.welcomeMsg) dom.welcomeMsg.style.display = 'none';

        addMessage(text || '分析上传文件...', 'user');
        dom.userInput.value = '';
        dom.userInput.style.height = 'auto';
        dom.statusText.textContent = '分析中...';

        try {
            const res = await fetch('/api/analyze', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ topic: text, file_content: state.fileContent })
            });
            const data = await res.json();

            if (res.ok) {
                dom.editor.value = data.system_prompt;

                // Render writing options
                if (data.writing_options && data.writing_options.length > 0) {
                    state.writingOptions = data.writing_options;
                    renderOptions(data.writing_options);
                    dom.optionsSection.classList.remove('hidden');
                }

                addMessage(`已生成写作方案（角色: ${data.persona}，类型: ${data.article_type}）。请选择写作配置后点击"生成文章"。`, 'ai');
                dom.generateBtn.disabled = false;
                dom.statusText.textContent = '请配置选项';
                openPanel();
            } else {
                addMessage('分析失败: ' + data.detail, 'ai');
                dom.statusText.textContent = '错误';
            }
        } catch (err) {
            console.error(err);
            addMessage('网络错误', 'ai');
        }
    }

    // Render dynamic options
    function renderOptions(options) {
        dom.optionsContainer.innerHTML = '';
        state.selectedOptions = {};

        options.forEach(opt => {
            const item = document.createElement('div');
            item.className = 'option-item';

            const label = document.createElement('div');
            label.className = 'option-label';
            label.textContent = opt.label;
            item.appendChild(label);

            if (opt.type === 'select' && opt.options) {
                const selectDiv = document.createElement('div');
                selectDiv.className = 'option-select';

                opt.options.forEach((choice, idx) => {
                    const chip = document.createElement('button');
                    chip.className = 'option-chip';
                    chip.textContent = choice;
                    if (choice === opt.default || (idx === 0 && !opt.default)) {
                        chip.classList.add('selected');
                        state.selectedOptions[opt.id] = choice;
                    }
                    chip.addEventListener('click', () => {
                        selectDiv.querySelectorAll('.option-chip').forEach(c => c.classList.remove('selected'));
                        chip.classList.add('selected');
                        state.selectedOptions[opt.id] = choice;
                    });
                    selectDiv.appendChild(chip);
                });
                item.appendChild(selectDiv);

            } else if (opt.type === 'toggle') {
                const toggleDiv = document.createElement('div');
                toggleDiv.className = 'option-toggle';

                ['是', '否'].forEach((val, idx) => {
                    const btn = document.createElement('button');
                    btn.className = 'toggle-btn';
                    btn.textContent = val;
                    const defaultVal = opt.default === '是' || opt.default === 'true' || opt.default === true;
                    if ((val === '是' && defaultVal) || (val === '否' && !defaultVal)) {
                        btn.classList.add('active');
                        state.selectedOptions[opt.id] = val === '是';
                    }
                    btn.addEventListener('click', () => {
                        toggleDiv.querySelectorAll('.toggle-btn').forEach(b => b.classList.remove('active'));
                        btn.classList.add('active');
                        state.selectedOptions[opt.id] = val === '是';
                    });
                    toggleDiv.appendChild(btn);
                });
                item.appendChild(toggleDiv);

            } else if (opt.type === 'range') {
                const rangeDiv = document.createElement('div');
                rangeDiv.className = 'option-range';

                const rangeInput = document.createElement('input');
                rangeInput.type = 'range';
                rangeInput.min = opt.min_val || 1000;
                rangeInput.max = opt.max_val || 10000;
                rangeInput.value = opt.default || 3000;
                rangeInput.step = 500;

                const rangeValue = document.createElement('span');
                rangeValue.className = 'range-value';
                rangeValue.textContent = rangeInput.value;
                state.selectedOptions[opt.id] = parseInt(rangeInput.value);

                rangeInput.addEventListener('input', () => {
                    rangeValue.textContent = rangeInput.value;
                    state.selectedOptions[opt.id] = parseInt(rangeInput.value);
                });

                rangeDiv.appendChild(rangeInput);
                rangeDiv.appendChild(rangeValue);
                item.appendChild(rangeDiv);
            }

            dom.optionsContainer.appendChild(item);
        });
    }

    // Toggle options visibility
    dom.optionsToggle.addEventListener('click', () => {
        const container = dom.optionsContainer;
        if (container.style.display === 'none') {
            container.style.display = 'flex';
            dom.optionsToggle.textContent = '收起';
        } else {
            container.style.display = 'none';
            dom.optionsToggle.textContent = '展开';
        }
    });

    // Export prompt button - download full prompt with selected options
    dom.exportPromptBtn.addEventListener('click', () => {
        let prompt = dom.editor.value;

        // Append selected options
        if (Object.keys(state.selectedOptions).length > 0) {
            prompt += '\n\n【用户选择的配置】\n';
            for (const [key, value] of Object.entries(state.selectedOptions)) {
                const opt = state.writingOptions.find(o => o.id === key);
                const label = opt ? opt.label : key;
                prompt += `${label}: ${value}\n`;
            }
        }

        // Create and download file
        const blob = new Blob([prompt], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `writing_prompt_${Date.now()}.txt`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        addMessage('提示词已导出为txt文件！', 'ai');
    });


    // Global Download Button Handler - downloads current editor content
    dom.downloadBtn.addEventListener('click', async () => {
        const content = dom.editor.value;
        if (!content) {
            addMessage('没有可下载的内容', 'error');
            return;
        }

        try {
            const res = await fetch('/api/generate_docx', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ content: content })
            });

            const data = await res.json();
            if (res.ok) {
                window.open(data.download_url, '_blank');
            } else {
                addMessage('下载失败: ' + (data.detail || '未知错误'), 'error');
            }
        } catch (e) {
            console.error(e);
            addMessage('下载请求失败', 'error');
        }
    });

    // Stop button handler
    dom.stopBtn.addEventListener('click', () => {
        if (state.abortController) {
            state.abortController.abort();
            state.abortController = null;
            dom.statusText.textContent = '已停止';
            dom.stopBtn.style.display = 'none';
            dom.generateBtn.disabled = false;
            dom.generateBtn.textContent = '重新生成';
            addMessage('生成已手动停止', 'ai');
        }
    });

    // Generate article (Streaming)
    dom.generateBtn.addEventListener('click', async () => {
        let prompt = dom.editor.value;
        if (!prompt) return;

        // Store original prompt for later editing
        state.originalPrompt = prompt;

        // Append selected options to prompt
        if (Object.keys(state.selectedOptions).length > 0) {
            prompt += '\n\n【用户选择的配置】\n';
            for (const [key, value] of Object.entries(state.selectedOptions)) {
                const opt = state.writingOptions.find(o => o.id === key);
                const label = opt ? opt.label : key;
                prompt += `${label}: ${value}\n`;
            }
        }

        // Create AbortController for this request
        state.abortController = new AbortController();

        dom.generateBtn.disabled = true;
        dom.generateBtn.textContent = '写作中...';
        dom.stopBtn.style.display = 'flex';  // Show stop button
        dom.statusText.textContent = '写作中...';
        dom.editor.value = ''; // Clear editor for streaming content
        dom.optionsSection.classList.add('hidden'); // Hide options

        let contentId = null;

        try {
            const res = await fetch('/api/write/stream', {
                method: 'POST',
                signal: state.abortController.signal,  // Pass abort signal
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    system_prompt: prompt,
                    user_instructions: 'Write the article.',
                    selected_options: state.selectedOptions
                })
            });

            const reader = res.body.getReader();
            const decoder = new TextDecoder();
            let fullContent = '';

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                const chunk = decoder.decode(value, { stream: true });

                // Check if this chunk contains the content ID marker
                if (chunk.includes('[CONTENT_ID:')) {
                    const match = chunk.match(/\[CONTENT_ID:([^\]]+)\]/);
                    if (match) {
                        contentId = match[1];
                        // Remove the marker from displayed content
                        const cleanChunk = chunk.replace(/\n?\[CONTENT_ID:[^\]]+\]/, '');
                        fullContent += cleanChunk;
                        dom.editor.value += cleanChunk;
                    }
                } else {
                    fullContent += chunk;
                    dom.editor.value += chunk;
                }

                // Auto-scroll to bottom
                dom.editor.scrollTop = dom.editor.scrollHeight;
            }

            dom.statusText.textContent = '完成';
            dom.stopBtn.style.display = 'none';  // Hide stop button
            addMessage('文章已生成完毕！', 'ai');

            // Enable download button and edit settings button
            dom.editSettingsBtn.style.display = 'flex';
            dom.downloadBtn.style.display = 'flex';
        } catch (err) {
            if (err.name === 'AbortError') {
                console.log('Generation aborted by user');
            } else {
                console.error(err);
                addMessage('生成失败', 'ai');
            }
        } finally {
            dom.stopBtn.style.display = 'none';  // Hide stop button
            state.abortController = null;
            dom.generateBtn.disabled = false;
            dom.generateBtn.textContent = '重新生成';
        }
    });

    // Edit settings button - restore options and prompt view
    dom.editSettingsBtn.addEventListener('click', () => {
        if (state.originalPrompt) {
            dom.editor.value = state.originalPrompt;
            dom.optionsSection.classList.remove('hidden');
            dom.statusText.textContent = '修改设置';
            addMessage('已切换到设置编辑模式，修改后点击"重新生成"', 'ai');
        }
    });


    // Panel controls
    dom.openEditorBtn.addEventListener('click', openPanel);
    dom.closePanelBtn.addEventListener('click', closePanel);

    function openPanel() {
        dom.editorPanel.classList.add('open');
    }

    function closePanel() {
        dom.editorPanel.classList.remove('open');
    }

    // Show/hide expand button based on text selection
    dom.editor.addEventListener('mouseup', checkSelection);
    dom.editor.addEventListener('keyup', checkSelection);

    function checkSelection() {
        const selected = dom.editor.value.substring(
            dom.editor.selectionStart,
            dom.editor.selectionEnd
        );
        if (selected.length > 10) {
            dom.expandBtn.style.display = 'flex';
        } else {
            dom.expandBtn.style.display = 'none';
        }
    }

    // Expand selected text
    dom.expandBtn.addEventListener('click', async () => {
        const start = dom.editor.selectionStart;
        const end = dom.editor.selectionEnd;
        const selectedText = dom.editor.value.substring(start, end);

        if (selectedText.length < 10) {
            addMessage('请先选中要扩展的文字（至少10个字）', 'ai');
            return;
        }

        dom.expandBtn.disabled = true;
        dom.statusText.textContent = '扩展中...';

        // Store the parts before and after the selection
        const beforeText = dom.editor.value.substring(0, start);
        const afterText = dom.editor.value.substring(end);

        // Insert start marker and prepare for streaming
        dom.editor.value = beforeText + '【扩展内容开始】\n';
        const streamStartPos = dom.editor.value.length;

        try {
            const res = await fetch('/api/expand', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ selected_text: selectedText })
            });

            const reader = res.body.getReader();
            const decoder = new TextDecoder();

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                const chunk = decoder.decode(value, { stream: true });
                // Append chunk in real-time (before the after-text)
                dom.editor.value = dom.editor.value + chunk;
                dom.editor.scrollTop = dom.editor.scrollHeight;
            }

            // Add end marker and restore the rest
            dom.editor.value = dom.editor.value + '\n【扩展内容结束】' + afterText;

            dom.statusText.textContent = '扩展完成';
            addMessage('选中内容已扩展！', 'ai');
        } catch (err) {
            console.error(err);
            addMessage('扩展失败', 'ai');
            // Restore original content on error
            dom.editor.value = beforeText + selectedText + afterText;
        } finally {
            dom.expandBtn.disabled = false;
            dom.expandBtn.style.display = 'none';
        }
    });


    function addMessage(text, type) {
        const div = document.createElement('div');
        div.className = `message ${type}`;
        div.innerHTML = `<div class="bubble">${text}</div>`;
        dom.chatHistory.appendChild(div);
        dom.chatArea.scrollTop = dom.chatArea.scrollHeight;
    }

    // App title hover effect for author tooltip
    const appTitleWrapper = document.getElementById('appTitleWrapper');
    const authorTooltip = document.getElementById('authorTooltip');

    if (appTitleWrapper && authorTooltip) {
        appTitleWrapper.addEventListener('mouseenter', () => {
            authorTooltip.style.opacity = '1';
            authorTooltip.style.transform = 'translateY(0)';
        });

        appTitleWrapper.addEventListener('mouseleave', () => {
            authorTooltip.style.opacity = '0';
            authorTooltip.style.transform = 'translateY(-5px)';
        });
    }
});
