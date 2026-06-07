/* ========================================================================= */
/* TÂM TRÍ (ENGINE) SƠ ĐỒ TƯ DUY - ZOOM MƯỢT MÀ VÀ BÁM CHUỘT TUYỆT ĐỐI       */
/* ========================================================================= */
let mmScale = 1;
let mmPanning = false;
let mmPointX = 0; let mmPointY = 0;
let mmStartX = 0; let mmStartY = 0;
let isMapInitialized = false;

const defaultMindmapData = [
    { id: 'node_default_root', type: 'root', time: '2879 TCN', title: 'Thời kỳ Hồng Bàng', desc: 'Nhập nội dung tóm tắt kỷ nguyên này...', parentId: null },
  
];

let mindmapData = [];

document.addEventListener('DOMContentLoaded', () => {
    initMindmapViewport();
    loadMindmapFromDatabase(); // Đổi từ render thẳng sang gọi Database trước
});

// GỌI API LẤY DỮ LIỆU TỪ DATABASE
async function loadMindmapFromDatabase() {
    try {
        const response = await fetch(`${API_BASE_URL}/mindmap`);
        const result = await response.json();
        
        if (result.status === 'success' && result.data) {
            // Có dữ liệu thật
            mindmapData = JSON.parse(result.data);
        } else {
            // Không có dữ liệu, nhồi bảng mẫu vào
            mindmapData = JSON.parse(JSON.stringify(defaultMindmapData)); // Clone ra để không hỏng gốc
        }
    } catch (e) {
        console.error("Lỗi lấy sơ đồ, chạy bản offline:", e);
        mindmapData = JSON.parse(JSON.stringify(defaultMindmapData));
    }
    
    // Đã có dữ liệu, tiến hành vẽ ra
    renderMindmapDOM();
}

window.saveMindmap = async function() {
    const btnSave = document.querySelector('.mindmap-actions .apple-btn-primary');
    const originalText = btnSave.innerHTML;
    
    btnSave.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Đang lưu...';
    btnSave.disabled = true;

    try {
        const payload = JSON.stringify(mindmapData);
        
        const response = await fetch(`${API_BASE_URL}/mindmap`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ json_data: payload })
        });
        
        if(response.ok) {
            if(typeof showAdminToast === 'function') showAdminToast("Lưu Sơ đồ tư duy thành công!");
            else alert("Đã lưu Sơ đồ thành công!");
            
            btnSave.innerHTML = '<i class="fa-solid fa-check"></i> Đã lưu';
            setTimeout(() => { btnSave.innerHTML = originalText; btnSave.disabled = false; }, 2000);
        } else {
            throw new Error("Lỗi Server");
        }
    } catch (e) {
        console.error("Lỗi lưu sơ đồ:", e);
        if(typeof showAdminToast === 'function') showAdminToast("Lỗi khi lưu sơ đồ! Kiểm tra mạng.", "error");
        else alert("Lỗi khi lưu sơ đồ!");
        
        btnSave.innerHTML = originalText;
        btnSave.disabled = false;
    }
}

// ==========================================
// 1. ENGINE PAN & ZOOM TO CURSOR CHUẨN XÁC
// ==========================================
function initMindmapViewport() {
    const viewport = document.getElementById('mindmapViewport');
    if (!viewport) return;

    if (!isMapInitialized) {
        const vRect = viewport.getBoundingClientRect();
        // Căn giữa chính xác vào trục tọa độ
        mmPointX = (vRect.width / 2) - 5000;  
        mmPointY = (vRect.height / 2) - 10000; 
        isMapInitialized = true;
        applyMindmapTransform(false);
    }

    viewport.addEventListener('mousedown', (e) => {
        if (e.target.closest('.mm-node') || e.target.closest('.mm-era-label') || e.target.closest('button')) return; 
        e.preventDefault();
        mmPanning = true;
        mmStartX = e.clientX - mmPointX;
        mmStartY = e.clientY - mmPointY;
    });

    viewport.addEventListener('mousemove', (e) => {
        if (!mmPanning) return;
        mmPointX = e.clientX - mmStartX;
        mmPointY = e.clientY - mmStartY;
        applyMindmapTransform(false); 
    });

    viewport.addEventListener('mouseup', () => mmPanning = false);
    viewport.addEventListener('mouseleave', () => mmPanning = false);

    // THUẬT TOÁN ZOOM BÁM THEO CHUỘT MƯỢT MÀ (Miro/Figma Style)
    viewport.addEventListener('wheel', (e) => {
        e.preventDefault();
        const rect = viewport.getBoundingClientRect();
        
        // Vị trí con trỏ chuột trên màn hình
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;

        // Tính lực cuộn chuẩn hóa (Math.sign chỉ trả về 1 hoặc -1 để chống sốc)
        const delta = Math.sign(e.deltaY);
        const zoomIntensity = 0.08; // Chỉ zoom 8% mỗi lần cuộn (Cảm giác cực kỳ mượt)
        const zoomFactor = delta > 0 ? (1 - zoomIntensity) : (1 + zoomIntensity);

        let newScale = mmScale * zoomFactor;
        newScale = Math.min(Math.max(0.15, newScale), 3.5); // Giới hạn từ 15% đến 350%

        // Tìm tọa độ Canvas thực tế đang nằm dưới con trỏ chuột
        const canvasX = (mouseX - mmPointX) / mmScale;
        const canvasY = (mouseY - mmPointY) / mmScale;

        // Dịch chuyển X, Y để điểm Canvas đó không bị lệch đi đâu
        mmPointX = mouseX - canvasX * newScale;
        mmPointY = mouseY - canvasY * newScale;
        mmScale = newScale;

        applyMindmapTransform(false);
    }, { passive: false });
}

function applyMindmapTransform(animate = false) {
    const canvas = document.getElementById('mindmapCanvas');
    if (!canvas) return;

    if (animate) {
        canvas.style.transition = 'transform 0.4s cubic-bezier(0.22, 1, 0.36, 1)';
        setTimeout(() => { canvas.style.transition = 'none'; }, 400); 
    } else {
        canvas.style.transition = 'none';
    }
    
    canvas.style.transform = `translate(${mmPointX}px, ${mmPointY}px) scale(${mmScale})`;
    drawMindmapConnections(); 
}

// Nút Zoom (+/-)
window.zoomMindmap = function(factor) {
    const viewport = document.getElementById('mindmapViewport');
    const vRect = viewport.getBoundingClientRect();
    
    const vCenterX = vRect.width / 2;
    const vCenterY = vRect.height / 2;

    const canvasX = (vCenterX - mmPointX) / mmScale;
    const canvasY = (vCenterY - mmPointY) / mmScale;

    let newScale = mmScale + factor;
    newScale = Math.min(Math.max(0.15, newScale), 3.5);

    mmPointX = vCenterX - canvasX * newScale;
    mmPointY = vCenterY - canvasY * newScale;
    mmScale = newScale;
    
    applyMindmapTransform(true);
}

window.resetZoomMindmap = function() {
    const firstRoot = mindmapData.find(n => n.parentId === null);
    if (firstRoot) focusNode(firstRoot.id);
}

// ==========================================
// TÍNH TOÁN TỌA ĐỘ PHÓNG TỚI ĐÍCH (FOCUS)
// ==========================================
window.focusNode = function(nodeId) {
    const node = document.getElementById(nodeId);
    const viewport = document.getElementById('mindmapViewport');
    if (!node || !viewport) return;

    const vRect = viewport.getBoundingClientRect();
    const nRect = node.getBoundingClientRect();

    // Tâm của thẻ bài trên màn hình
    const nCenterX = nRect.left + nRect.width / 2;
    const nCenterY = nRect.top + nRect.height / 2;

    const vCenterX = vRect.width / 2;
    const vCenterY = vRect.height / 2;

    // Tọa độ gốc trên Canvas
    const canvasX = (nCenterX - vRect.left - mmPointX) / mmScale;
    const canvasY = (nCenterY - vRect.top - mmPointY) / mmScale;

    // Đặt Zoom mặc định khi nhìn thẻ bài là 1.15
    const targetScale = 1.15; 

    // Bay tới chính giữa
    mmPointX = vCenterX - canvasX * targetScale;
    mmPointY = vCenterY - canvasY * targetScale;
    mmScale = targetScale;

    applyMindmapTransform(true);
};

// ==========================================
// 2. ENGINE RENDER GIAO DIỆN
// ==========================================
function generateMMId() { return 'mm_' + Date.now() + Math.floor(Math.random() * 1000); }

window.addMindmapEra = function() {
    mindmapData.push({ id: generateMMId(), type: 'root', time: 'Năm...', title: 'Kỷ nguyên mới', desc: '', parentId: null });
    renderMindmapDOM();
}

window.addMindmapChild = function(parentId, type) {
    mindmapData.push({ id: generateMMId(), type: type, time: '', title: type === 'sub' ? 'Bảng con mới' : 'Nội dung chi tiết', desc: '', parentId: parentId });
    renderMindmapDOM();
}

window.deleteMindmapNode = function(nodeId) {
    if(!confirm("Xóa thẻ này sẽ xóa cả thẻ con bên trong. Bạn chắc chắn chứ?")) return;
    const idsToDelete = new Set([nodeId]);
    let size = 0;
    while(size !== idsToDelete.size) {
        size = idsToDelete.size;
        mindmapData.forEach(n => { if (idsToDelete.has(n.parentId)) idsToDelete.add(n.id); });
    }
    mindmapData = mindmapData.filter(n => !idsToDelete.has(n.id));
    renderMindmapDOM();
}

window.updateNodeData = function(id, field, value) {
    const node = mindmapData.find(n => n.id === id);
    if (node) node[field] = value;
}

function renderMindmapDOM() {
    const container = document.getElementById('mindmapNodesContainer');
    container.innerHTML = '';

    const roots = mindmapData.filter(n => n.parentId === null);

    roots.forEach((root, index) => {
        const side = index % 2 === 0 ? 'right' : 'left'; 
        
        // BỌC THÊM WRAPPER ĐỂ KHÓA CHẶT VÀO GIỮA TRỤC
        const wrapperEl = document.createElement('div');
        wrapperEl.className = 'mm-branch-wrapper';

        const branchEl = document.createElement('div');
        branchEl.className = `mm-branch ${side}-side`;
        
        const rootZone = document.createElement('div');
        rootZone.className = 'mm-root-zone';
        rootZone.innerHTML = `
            <input class="mm-era-label" value="${root.time}" onchange="updateNodeData('${root.id}', 'time', this.value)" placeholder="Nhập Năm...">
            <div class="mm-node root-node" id="${root.id}" ondblclick="focusNode('${root.id}')">
                <input class="mm-input mm-title" value="${root.title}" onchange="updateNodeData('${root.id}', 'title', this.value)" placeholder="Tên Kỷ Nguyên...">
                <textarea class="mm-input mm-desc" onchange="updateNodeData('${root.id}', 'desc', this.value)" placeholder="Tóm tắt..." oninput="this.style.height = ''; this.style.height = this.scrollHeight + 'px'; window.drawMindmapConnections();">${root.desc}</textarea>
                <div class="mm-node-actions">
                    <button class="mm-btn mm-btn-focus" onclick="focusNode('${root.id}')" title="Phóng tới"><i class="fa-solid fa-crosshairs"></i></button>
                    <button class="mm-btn mm-btn-sub" onclick="addMindmapChild('${root.id}', 'sub')">+ Bảng con</button>
                    <button class="mm-btn mm-btn-content" onclick="addMindmapChild('${root.id}', 'content')">+ Nội dung</button>
                    <button class="mm-btn mm-btn-del" onclick="deleteMindmapNode('${root.id}')"><i class="fa-solid fa-trash"></i></button>
                </div>
            </div>
        `;
        branchEl.appendChild(rootZone);

        const children = mindmapData.filter(n => n.parentId === root.id);
        if (children.length > 0) {
            const childrenGroup = document.createElement('div');
            childrenGroup.className = 'mm-children-group';
            children.forEach(child => {
                childrenGroup.appendChild(buildChildHTML(child));
            });
            branchEl.appendChild(childrenGroup);
        }

        wrapperEl.appendChild(branchEl);
        container.appendChild(wrapperEl);
    });

    // Tìm đoạn này ở cuối hàm renderMindmapDOM() trong file admin-mindmap.js
setTimeout(() => { 
    
    // --- BỔ SUNG ĐOẠN CODE NÀY ---
    // Duyệt qua tất cả các ô mô tả và tự động ép dãn chiều cao theo dữ liệu thực tế
    document.querySelectorAll('.mm-desc').forEach(textarea => {
        textarea.style.height = 'auto'; // Reset lại dòng trống
        textarea.style.height = textarea.scrollHeight + 'px'; // Kéo dãn theo chiều cao thực tế của chữ
    });
    // -----------------------------

    drawMindmapConnections(); // Hàm vẽ lại dây nối của bạn
    if(isMapInitialized === false && roots.length > 0) {
        focusNode(roots[0].id);
        isMapInitialized = true;
    }
}, 50);
}

function buildChildHTML(node) {
    const wrapper = document.createElement('div');
    wrapper.className = 'mm-wrapper';
    wrapper.id = 'wrap_' + node.id;

    wrapper.innerHTML = `
        <div class="mm-node ${node.type}-node" id="${node.id}" ondblclick="focusNode('${node.id}')">
            <input class="mm-input mm-title" value="${node.title}" onchange="updateNodeData('${node.id}', 'title', this.value)" placeholder="Tiêu đề...">
            <textarea class="mm-input mm-desc" onchange="updateNodeData('${node.id}', 'desc', this.value)" placeholder="Nội dung..." oninput="this.style.height = ''; this.style.height = this.scrollHeight + 'px'; window.drawMindmapConnections();">${node.desc}</textarea>
            <div class="mm-node-actions">
                <button class="mm-btn mm-btn-focus" onclick="focusNode('${node.id}')" title="Phóng tới"><i class="fa-solid fa-crosshairs"></i></button>
                ${node.type !== 'content' ? `<button class="mm-btn mm-btn-sub" onclick="addMindmapChild('${node.id}', 'sub')">+ Bảng con</button>` : ''}
                <button class="mm-btn mm-btn-content" onclick="addMindmapChild('${node.id}', 'content')">+ Nội dung</button>
                <button class="mm-btn mm-btn-del" onclick="deleteMindmapNode('${node.id}')"><i class="fa-solid fa-trash"></i></button>
            </div>
        </div>
    `;

    const children = mindmapData.filter(n => n.parentId === node.id);
    if (children.length > 0) {
        const childrenGroup = document.createElement('div');
        childrenGroup.className = 'mm-children-group';
        children.forEach(child => {
            childrenGroup.appendChild(buildChildHTML(child));
        });
        wrapper.appendChild(childrenGroup);
    }

    return wrapper;
}

// ==========================================
// 3. ENGINE VẼ DÂY NỐI TỰ ĐỘNG
// ==========================================
window.drawMindmapConnections = function() {
    const svg = document.getElementById('mindmapEdges');
    const canvas = document.getElementById('mindmapCanvas');
    if (!svg || !canvas) return;

    svg.innerHTML = ''; 
    const canvasRect = canvas.getBoundingClientRect();

    mindmapData.forEach(node => {
        if (!node.parentId) return; 

        const parentEl = document.getElementById(node.parentId);
        const childEl = document.getElementById(node.id);

        if (parentEl && childEl) {
            const pRect = parentEl.getBoundingClientRect();
            const cRect = childEl.getBoundingClientRect();

            const isLeft = childEl.closest('.mm-branch').classList.contains('left-side');
            
            let startX, endX;
            if (isLeft) {
                startX = (pRect.left - canvasRect.left) / mmScale;
                endX = (cRect.right - canvasRect.left) / mmScale;
            } else {
                startX = (pRect.right - canvasRect.left) / mmScale;
                endX = (cRect.left - canvasRect.left) / mmScale;
            }

            const startY = (pRect.top + pRect.height / 2 - canvasRect.top) / mmScale;
            const endY = (cRect.top + cRect.height / 2 - canvasRect.top) / mmScale;

            const curvature = 0.5;
            const cp1X = startX + (endX - startX) * curvature;
            const cp2X = endX - (endX - startX) * curvature;

            const pathData = `M ${startX} ${startY} C ${cp1X} ${startY}, ${cp2X} ${endY}, ${endX} ${endY}`;
            
            const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
            path.setAttribute('d', pathData);
            
            if(node.type === 'content') path.setAttribute('stroke', '#93c5fd'); 
            else path.setAttribute('stroke', '#fcd34d'); 

            svg.appendChild(path);
        }
    });
}