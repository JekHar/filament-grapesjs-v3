document.addEventListener('alpine:init', () => {
    Alpine.data(
        "grapesjs",
        ({ state, statePath, readOnly, tools, minHeight, container }) => ({
            instance: null,
            state: state,
            tools: tools,

            init() {
                this.instance = grapesjs.init({
                    height: minHeight + 'px',
                    container: container ? container : ".filament-grapesjs .grapesjs-wrapper",
                    showOffsets: true,
                    fromElement: true,
                    noticeOnUnload: false,
                    storageManager: false,
                    loadHtml: state,
                    plugins: [
                        "grapesjs-tailwind",
                        "grapesjs-preset-webpage",
                        "grapesjs-component-code-editor",
                        "grapesjs-custom-code",
                        ""
                    ],
                    assetManager: {
                        upload: '/grapesjs/media',
                        autoAdd: true, // Agrega automáticamente las imágenes después de subirlas
                        assets: [], // Se llenará con imágenes desde el servidor
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
                                            // Agregar imagen a GrapesJS
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


                this.instance.on('update', e => {
                    var content = this.instance.getHtml({
                        cleanId: true
                    });
                    var extract = content.match(/<body\b[^>]*>([\s\S]*?)<\/body>/);
                    this.state = extract ? extract[1] : this.instance.getHtml();
                });
            }
        })
    );
});