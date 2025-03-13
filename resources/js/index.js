document.addEventListener('alpine:init', () => {
    Alpine.data(
        "grapesjs",
        ({ state, statePath, readOnly, tools, minHeight, container }) => ({
            instance: null,
            state: state,
            tools: tools,

            init() {
                // Initialize GrapesJS
                this.instance = grapesjs.init({
                    height: minHeight + 'px',
                    container: container ? container : ".filament-grapesjs .grapesjs-wrapper",
                    showOffsets: true,
                    fromElement: true,
                    noticeOnUnload: false,
                    storageManager: false,
                    loadHtml: state,
                    panels: {
                        defaults: [
                            {
                                buttons: [
                                    {
                                        attributes: { title: 'Open Code' },
                                        className: 'fa fa-code',
                                        command: 'open-code',
                                        id: 'open-code'
                                    }
                                ],
                                id: 'views'
                            }
                        ]
                    },
                    plugins: [
                        "grapesjs-tailwind",
                        "grapesjs-preset-webpage",
                        "grapesjs-component-code-editor",
                        "grapesjs-custom-code"
                    ],
                    assetManager: {
                        upload: '/grapesjs/media',
                        autoAdd: true,
                        assets: [],
                        uploadFile: (e) => {
                            const files = e.dataTransfer ? e.dataTransfer.files : e.target.files;
                            const formData = new FormData();

                            for (let i = 0; i < files.length; i++) {
                                formData.append('files[]', files[i]);
                            }

                            fetch('/grapesjs/media', {
                                method: 'POST',
                                headers: {
                                    'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]').content
                                },
                                body: formData
                            })
                                .then(response => {
                                    if (!response.ok) throw new Error('Upload failed');
                                    return response.json();
                                })
                                .then(result => {
                                    if (Array.isArray(result)) {
                                        result.forEach(asset => {
                                            this.instance.AssetManager.add(asset);
                                        });
                                    } else {
                                        this.instance.AssetManager.add([result]);
                                    }
                                })
                                .catch(error => console.error('Error:', error));
                        }
                    }
                });

                // Register the non-editable component type
                this.instance.Components.addType('non-editable', {
                    model: {
                        defaults: {
                            editable: false,
                            draggable: false,
                            droppable: false,
                            copyable: false,
                            removable: false,
                            highlightable: false,
                            selectable: false,
                        }
                    },
                    view: {
                        events: {
                            click: e => e.stopPropagation(),
                            dblclick: e => e.stopPropagation(),
                            mousedown: e => e.stopPropagation()
                        },
                        onRender({ el }) {
                            el.style.pointerEvents = 'none';
                            el.style.opacity = '0.8';
                        }
                    }
                });

                // Function to process non-editable components
                const processNonEditableComponents = () => {
                    // Get all components
                    const allComponents = this.instance.Components.getWrapper().find('*');

                    // Find elements with the gjs-non-editable class and set their type
                    allComponents.forEach(component => {
                        const classes = component.getClasses();
                        if (classes.includes('gjs-non-editable')) {
                            // Instead of just setting the type, we'll set all the non-editable properties directly
                            component.set({
                                type: 'non-editable',
                                editable: false,
                                draggable: false,
                                droppable: false,
                                copyable: false,
                                removable: false,
                                highlightable: false,
                                selectable: false,
                            });

                            // Also add a special attribute to ensure consistency
                            component.addAttributes({ 'data-gjs-locked': true });

                            // Make it visually distinct and non-interactive
                            const el = component.getEl();
                            if (el) {
                                el.style.pointerEvents = 'none';
                                el.style.opacity = '0.8';
                            }
                        }
                    });
                };

                // Process components after loading
                this.instance.on('load', processNonEditableComponents);

                // Also process after any component changes to ensure consistency
                this.instance.on('component:update', (component) => {
                    if (component.getClasses().includes('gjs-non-editable')) {
                        component.set({
                            editable: false,
                            draggable: false,
                            droppable: false,
                            copyable: false,
                            removable: false,
                            highlightable: false,
                            selectable: false,
                        });
                    }
                });

                // Process any new components added
                this.instance.on('component:add', (component) => {
                    if (component.getClasses().includes('gjs-non-editable')) {
                        component.set({
                            type: 'non-editable',
                            editable: false,
                            draggable: false,
                            droppable: false,
                            copyable: false,
                            removable: false,
                            highlightable: false,
                            selectable: false,
                        });
                    }
                });

                fetch('/grapesjs/media')
                    .then(response => {
                        if (!response.ok) throw new Error('Failed to fetch assets');
                        return response.json();
                    })
                    .then(assets => {
                        if (Array.isArray(assets)) {
                            this.instance.AssetManager.add(assets);
                        }
                    })
                    .catch(error => console.error('Error:', error));

                // Save content but exclude non-editable regions
                this.instance.on('update', e => {
                    var content = this.instance.getHtml({
                        cleanId: true
                    });
                    var extract = content.match(/<body\b[^>]*>([\s\S]*?)<\/body>/);
                    var fullContent = extract ? extract[1] : content;

                    // Updated regex to match elements with the gjs-non-editable class
                    var editableContent = fullContent.replace(/<div[^>]*class=["'][^"']*gjs-non-editable[^"']*["'][^>]*>[\s\S]*?<\/div>/g, '');

                    this.state = editableContent.trim();
                });

                // Customize code view to hide non-editable components
                this.instance.on('codeEdit:before', () => {
                    // Store the original HTML
                    this._originalCodeViewHtml = this.instance.getHtml();

                    // Get HTML without non-editable components
                    let cleanHtml = this.instance.getHtml();
                    cleanHtml = cleanHtml.replace(/<div[^>]*class=["'][^"']*gjs-non-editable[^"']*["'][^>]*>[\s\S]*?<\/div>/g, '');

                    // Set the filtered HTML for code view
                    this.instance.setCustomCode(cleanHtml);
                });

                // Restore original HTML when exiting code view
                this.instance.on('codeEdit:after', () => {
                    // If we have stored original HTML, restore it
                    if (this._originalCodeViewHtml) {
                        // Get the current code
                        const currentCode = this.instance.getCustomCode();

                        // Only restore if the user hasn't modified the code
                        if (this._filteredCodeViewHtml === currentCode) {
                            this.instance.DomComponents.getWrapper().set('content', this._originalCodeViewHtml);
                        }

                        // Clear stored HTML
                        this._originalCodeViewHtml = null;
                        this._filteredCodeViewHtml = null;
                    }
                });

                // Override the open-code command to use our custom handler
                this.instance.Commands.add('open-code', {
                    run: function(editor, sender) {
                        // Get HTML without non-editable components
                        let cleanHtml = editor.getHtml();
                        cleanHtml = cleanHtml.replace(/<div[^>]*class=["'][^"']*gjs-non-editable[^"']*["'][^>]*>[\s\S]*?<\/div>/g, '');

                        // Store clean HTML for later comparison
                        editor._filteredCodeViewHtml = cleanHtml;

                        // Open code editor with clean HTML
                        editor.Modal.open({
                            title: 'Code Editor',
                            content: `<textarea style="width:100%; height:250px;">${cleanHtml}</textarea>`,
                            attributes: { class: 'gjs-modal-code' }
                        });
                    }
                });
            }
        })
    );
});