import { modalService } from './ModalService';

export class HelpModal {
    open(onClose?: () => void) {
        const container = document.createElement('div');
        container.className = 'help-modal';
        container.style.display = 'flex';
        container.style.flexDirection = 'column';
        container.style.gap = '24px';

        // Define shortcuts sections
        const sections = [
            {
                title: 'General',
                shortcuts: [
                    { key: 'H / ?', desc: 'Show this help' },
                    { key: 'ESC', desc: 'Pause Menu / Close Modal' },
                    { key: 'SHIFT+S', desc: 'Settings' },
                    { key: 'SHIFT+P', desc: 'Profile' },
                    { key: 'SHIFT+C', desc: 'Shop (Cues)' },
                ]
            },
            {
                title: 'Gameplay',
                shortcuts: [
                    { key: 'Click/Drag', desc: 'Aim / Power' },
                    { key: 'Space (Hold)', desc: 'Power Mode' },
                    { key: 'A', desc: 'Toggle Aim/Power Mode' },
                    { key: 'SHIFT', desc: 'Fine Aim / Move Ball' },
                    { key: 'R', desc: 'Restart Game' },
                ]
            },
            {
                title: 'Modes',
                shortcuts: [
                    { key: '8', desc: 'Toggle 8-Ball / Practice' },
                    { key: 'T', desc: 'Time Attack' },
                    { key: 'P', desc: 'Perfect Game' },
                    { key: 'V', desc: 'Speed Pool' },
                ]
            },
            {
                title: 'Tools',
                shortcuts: [
                    { key: 'G', desc: 'Modern Geometry Panel' },
                    { key: 'J', desc: 'Legacy Geometry Panel' },
                    { key: 'S', desc: 'Physics Settings' },
                    { key: 'M', desc: 'Measurement Overlay' },
                    { key: 'SHIFT+D', desc: 'Debug Overlay' },
                ]
            }
        ];

        // Render sections
        sections.forEach(section => {
            const sectionEl = document.createElement('div');
            
            const title = document.createElement('h3');
            title.className = 'u-font-heading';
            title.textContent = section.title;
            title.style.fontSize = '18px';
            title.style.color = 'var(--color-arcade-blue)';
            title.style.marginBottom = '12px';
            title.style.borderBottom = '1px solid rgba(255,255,255,0.1)';
            title.style.paddingBottom = '4px';
            sectionEl.appendChild(title);

            const list = document.createElement('div');
            list.style.display = 'grid';
            list.style.gridTemplateColumns = '120px 1fr';
            list.style.rowGap = '8px';
            list.style.columnGap = '16px';
            list.style.alignItems = 'center';

            section.shortcuts.forEach(s => {
                const kWrapper = document.createElement('div');
                kWrapper.style.textAlign = 'right';
                
                // Split keys if multiple (e.g. "H / ?")
                // We'll just wrap the whole string in a badge for now or style it inline
                const k = document.createElement('span');
                k.className = 'u-key-badge';
                k.textContent = s.key;
                k.style.background = 'rgba(255,255,255,0.1)';
                k.style.border = '1px solid rgba(255,255,255,0.2)';
                k.style.padding = '2px 6px';
                k.style.borderRadius = '4px';
                k.style.fontSize = '12px';
                k.style.fontWeight = 'bold';
                k.style.fontFamily = 'monospace';
                k.style.color = '#fff';
                k.style.display = 'inline-block';
                
                kWrapper.appendChild(k);

                const d = document.createElement('div');
                d.textContent = s.desc;
                d.style.color = 'rgba(255,255,255,0.8)';
                d.style.fontSize = '14px';

                list.appendChild(kWrapper);
                list.appendChild(d);
            });
            
            sectionEl.appendChild(list);
            container.appendChild(sectionEl);
        });

        modalService.show({
            title: 'KEYBOARD SHORTCUTS',
            content: container,
            className: 'help-modal',
            footer: this.createFooter(onClose)
        });
    }

    createFooter(onClose?: () => void) {
        const footer = document.createElement('div');
        footer.style.display = 'flex';
        footer.style.justifyContent = 'flex-end';
        
        const closeBtn = document.createElement('button');
        closeBtn.textContent = 'Close';
        closeBtn.className = 'btn-arcade btn-arcade-glass';
        closeBtn.style.padding = '10px 32px';
        closeBtn.onclick = () => {
            modalService.close();
            onClose?.();
        };

        footer.appendChild(closeBtn);
        return footer;
    }
}
