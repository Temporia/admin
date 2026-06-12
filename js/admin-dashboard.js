/* ========================================================================= */
/* TEMPORIA ADMIN DASHBOARD - ĐẦY ĐỦ TÍNH NĂNG KỊCH BẢN MAP & NHÂN VẬT       */
/* ========================================================================= */

// ==========================================
// 0. KHÓA CHẶN BẢO MẬT (AUTH GUARD)
// ==========================================
const adminSession = localStorage.getItem('admin_session');
const adminUserStr = localStorage.getItem('admin_user');

// Nếu không có phiên đăng nhập hợp lệ, lập tức đá văng về trang Auth
if (adminSession !== 'active' || !adminUserStr) {
    window.location.href = 'admin.html';
}

const API_BASE_URL = 'https://temporia-api.onrender.com/api';
let currentLessonId = null; 

// --- Biến cho Bản đồ ---
let adminMapInstance; 
let mapFeatureGroup;  
let mapScriptData = {}; 
let currentActiveGeoId = null; 
let selectedShape = null; 

// --- Biến cho Nhân vật & Huy chương ---
let charScriptData = {};
let currentActiveCharId = null;
let currentSelectedMedals = []; // Mảng huy chương của bài học
let medalSelectionTarget = 'lesson'; // Cờ hiệu phân biệt ai đang gọi Modal

/* ==========================================
   1. HỆ THỐNG THÔNG BÁO TOAST & CSS ĐỘNG
========================================== */
const style = document.createElement('style');
style.innerHTML = `
/* Toast */
.admin-toast-notification { position: fixed; bottom: 30px; right: -300px; background: #fff; padding: 15px 20px; border-radius: 12px; box-shadow: 0 10px 30px rgba(0,0,0,0.1); display: flex; align-items: center; gap: 12px; z-index: 999999; transition: right 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275); font-weight: 600; font-size: 0.95rem; color: #1d1d1f; border-left: 4px solid #22c55e; }
.admin-toast-notification.show { right: 30px; }

/* Medal Library */
.medal-grid-list { display: grid; grid-template-columns: repeat(auto-fill, minmax(100px, 1fr)); gap: 15px; max-height: 350px; overflow-y: auto; padding-right: 5px; }
.medal-item { border: 1px solid #e5e5ea; border-radius: 12px; padding: 10px; text-align: center; cursor: pointer; transition: all 0.2s; }
.medal-item:hover { border-color: #b91c1c; background: #fef2f2; transform: translateY(-2px); }
.medal-item img { width: 55px; height: 55px; object-fit: contain; margin-bottom: 8px; }
.medal-item span { font-size: 0.75rem; color: #1d1d1f; font-weight: 600; display: block; line-height: 1.3; }
.medal-grid-list::-webkit-scrollbar { width: 6px; }
.medal-grid-list::-webkit-scrollbar-thumb { background-color: #d2d2d7; border-radius: 10px; }

/* Selected Medals (Multi-select) */
.selected-medals-container { display: flex; flex-wrap: wrap; gap: 12px; padding: 15px; border: 2px dashed #d1d5db; border-radius: 12px; min-height: 80px; align-items: center; background: var(--bg-app); transition: 0.2s; }
.selected-medals-container:hover { border-color: #b91c1c; background: #fef2f2; }
.selected-medal-item { position: relative; width: 65px; height: 65px; border-radius: 50%; background: #fff; box-shadow: 0 4px 15px rgba(0,0,0,0.05); border: 2px solid #fff; display: flex; justify-content: center; align-items: center; transition: 0.2s; }
.selected-medal-item:hover { transform: translateY(-3px); box-shadow: 0 8px 20px rgba(185, 28, 28, 0.15); }
.selected-medal-item img { width: 45px; height: 45px; object-fit: contain; }
.remove-medal-btn { position: absolute; top: -5px; right: -5px; background: #dc2626; color: white; border: none; border-radius: 50%; width: 22px; height: 22px; font-size: 10px; cursor: pointer; display: flex; align-items: center; justify-content: center; box-shadow: 0 2px 5px rgba(0,0,0,0.2); }
.remove-medal-btn:hover { background: #991b1b; transform: scale(1.1); }
.add-medal-btn { width: 65px; height: 65px; border-radius: 50%; border: 2px dashed #a1a1aa; display: flex; align-items: center; justify-content: center; color: #a1a1aa; cursor: pointer; font-size: 1.5rem; transition: 0.2s; background: #fff; }
.add-medal-btn:hover { border-color: #b91c1c; color: #b91c1c; }

/* Character Keyword */
.char-btn { color: #b91c1c !important; font-weight: 600; background: #fef2f2 !important; }
.char-btn:hover { background: #fee2e2 !important; }
.char-keyword { color: #b91c1c; font-weight: 700; background: #fef2f2; padding: 2px 6px; border-radius: 6px; cursor: pointer; transition: 0.2s; border: 1px dashed transparent; }
.char-keyword:hover { border-color: #b91c1c; background: #fee2e2; }
#medalLibraryModal { z-index: 999999 !important; }
#characterModal { z-index: 999990 !important; }
`;
document.head.appendChild(style);

function showAdminToast(message, type = 'success') {
    const toast = document.getElementById('adminToast');
    const icon = document.getElementById('toastIcon');
    document.getElementById('toastMessage').innerText = message;
    
    if (type === 'success') {
        toast.style.borderLeft = '4px solid #22c55e';
        icon.className = 'fa-solid fa-circle-check';
        icon.style.color = '#22c55e';
    } else {
        toast.style.borderLeft = '4px solid #dc2626';
        icon.className = 'fa-solid fa-triangle-exclamation';
        icon.style.color = '#dc2626';
    }
    
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 3000);
}

document.addEventListener('DOMContentLoaded', () => {
    // TỰ ĐỘNG ĐIỀN TÊN TÁC GIẢ VÀO GÓC TRÊN CÙNG BÊN PHẢI
    if (adminUserStr) {
        try {
            const adminUser = JSON.parse(adminUserStr);
            const profileName = document.querySelector('.admin-profile span');
            const profileAvatar = document.querySelector('.admin-profile img');
            
            if (profileName && adminUser.full_name) {
                profileName.innerText = adminUser.full_name;
            }
            if (profileAvatar && adminUser.full_name) {
                // Đổi cả avatar thành chữ cái đầu tiên trong tên của họ
                profileAvatar.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(adminUser.full_name)}&background=b91c1c&color=fff`;
            }
        } catch(e) {
            console.error("Lỗi parse thông tin admin:", e);
        }
    }

    initAdminMap();
    initEditorClickListener();
    loadRoadmapTree();
});

/* ==========================================
   2. TƯƠNG TÁC GIAO DIỆN CHUNG
========================================== */
function switchModule(module, btnElement) {
    const slider = document.getElementById('moduleSlider');
    document.querySelectorAll('.module-btn').forEach(btn => btn.classList.remove('active'));
    btnElement.classList.add('active');
    slider.style.transform = module === 'roadmap' ? 'translateX(0)' : 'translateX(calc(100% + 4px))';
}

function toggleChapter(element) {
    element.parentElement.classList.toggle('expanded');
}

/* ==========================================
   3. THƯ VIỆN HUY CHƯƠNG CỤC BỘ (MULTI-SELECT)
========================================== */
const MEDAL_LIBRARY = [
    { name: 'Kinh Dương Vương', url: 'hinh nhân vật/KDVx.png' },
    { name: 'Lạc Long Quân', url: 'hinh nhân vật/LLQ.png' },
    { name: 'Hai Bà Trưng', url: 'hinh nhân vật/HBT.png' },
    { name: 'Lý Bí', url: 'hinh nhân vật/LyBi.png' },
    { name: 'Ngô Quyền', url: 'hinh nhân vật/NgoQuyen.png' },
    { name: 'Đinh Tiên Hoàng', url: 'hinh nhân vật/DinhTienHoang.png' },
    { name: 'Lê Hoàn', url: 'hinh nhân vật/LeHoan.png' },
    { name: 'Lý Thái Tổ', url: 'hinh nhân vật/LyThaiTo.png' },
    { name: 'Trần Hưng Đạo', url: 'hinh nhân vật/TranHungDao.png' },
    { name: 'Lê Lợi', url: 'hinh nhân vật/LeLoi.png' },
    { name: 'Quang Trung', url: 'hinh nhân vật/QuangTrung.png' },
    { name: 'Võ Nguyên Giáp', url: 'hinh nhân vật/VoNguyenGiap.png' },
    { name: 'Chiến Thắng', url: 'hinh nhân vật/ChienThang.png' }
];

function renderSelectedMedals() {
    const container = document.getElementById('selectedMedalsContainer');
    document.getElementById('medalCountTxt').innerText = currentSelectedMedals.length;
    document.getElementById('selectedMedalUrl').value = JSON.stringify(currentSelectedMedals);

    let html = currentSelectedMedals.map((url, index) => `
        <div class="selected-medal-item">
            <img src="${url}" alt="Medal">
            <button class="remove-medal-btn" onclick="removeMedal(${index}, event)"><i class="fa-solid fa-times"></i></button>
        </div>
    `).join('');

    html += `<div class="add-medal-btn" onclick="openMedalLibrary('lesson')" title="Thêm huy chương"><i class="fa-solid fa-plus"></i></div>`;
    container.innerHTML = html;
}

function removeMedal(index, event) {
    event.stopPropagation();
    currentSelectedMedals.splice(index, 1);
    renderSelectedMedals();
}

function openMedalLibrary(target = 'lesson') {
    medalSelectionTarget = target;
    document.getElementById('medalLibraryModal').classList.add('show');
    renderMedals(MEDAL_LIBRARY);
    document.getElementById('medalSearchInput').value = '';
}

function closeMedalLibrary() {
    document.getElementById('medalLibraryModal').classList.remove('show');
}

function renderMedals(list) {
    const grid = document.getElementById('medalGridList');
    if (list.length === 0) {
        grid.innerHTML = '<p style="grid-column: 1/-1; text-align: center; color: #86868b; margin-top: 20px;">Không tìm thấy huy chương nào.</p>';
        return;
    }
    grid.innerHTML = list.map(medal => `
        <div class="medal-item" onclick="selectMedal('${medal.url}')">
            <img src="${medal.url}" alt="${medal.name}" onerror="this.src='https://placehold.co/100x100?text=Lỗi+ảnh'">
            <span>${medal.name}</span>
        </div>
    `).join('');
}

function filterMedals() {
    const query = document.getElementById('medalSearchInput').value.toLowerCase();
    const filtered = MEDAL_LIBRARY.filter(m => m.name.toLowerCase().includes(query));
    renderMedals(filtered);
}

function selectMedal(url) {
    if (medalSelectionTarget === 'lesson') {
        if (!currentSelectedMedals.includes(url)) {
            currentSelectedMedals.push(url);
            renderSelectedMedals();
            showAdminToast("Đã thêm huy chương vào bài học!");
        } else {
            showAdminToast("Huy chương này đã được chọn rồi!", "error");
        }
    } else if (medalSelectionTarget === 'character') {
        document.getElementById('charSelectedMedalUrl').value = url;
        document.getElementById('charMedalPreview').src = url;
        document.getElementById('charMedalPreview').style.display = 'block';
        document.getElementById('charMedalPlaceholder').style.display = 'none';
        showAdminToast("Đã gán huy chương cho nhân vật!");
        closeMedalLibrary(); 
    }
}

/* ==========================================
   4. KẾT NỐI API DATABASE
========================================== */
async function loadRoadmapTree() {
    const chapterList = document.getElementById('chapterList');
    try {
        const response = await fetch(`${API_BASE_URL}/roadmap`);
        if (!response.ok) throw new Error("Lỗi Server");
        
        const data = await response.json();
        chapterList.innerHTML = ''; 
        
        data.chapters.forEach(chapter => {
            let lessonsHTML = '';
            chapter.lessons.forEach(lesson => {
                lessonsHTML += `<div class="lesson-item" onclick="loadLessonDetail(${lesson.id}, this)"><i class="fa-solid fa-file-lines"></i> ${lesson.title}</div>`;
            });

            chapterList.innerHTML += `
                <div class="tree-chapter">
                    <div class="chapter-header" onclick="toggleChapter(this)">
                        <i class="fa-solid fa-chevron-down arrow"></i>
                        <i class="fa-solid fa-folder folder-icon"></i>
                        <span>${chapter.name}</span>
                        <div style="margin-left: auto; display: flex; gap: 5px;">
                            <button class="btn-add-lesson" onclick="createNewLesson(event, ${chapter.id}, '${chapter.name}')" title="Thêm bài"><i class="fa-solid fa-plus"></i></button>
                            <button class="btn-add-lesson" style="color:#f59e0b;" onclick="editChapterName(event, ${chapter.id}, '${chapter.name}', ${chapter.order_num})" title="Sửa tên chương"><i class="fa-solid fa-pen"></i></button>
                            <button class="btn-add-lesson" style="color:#dc2626;" onclick="deleteChapter(event, ${chapter.id})" title="Xóa chương"><i class="fa-solid fa-trash"></i></button>
                        </div>
                    </div>
                    <div class="chapter-lessons">${lessonsHTML}</div>
                </div>
            `;
        });
    } catch (error) {
        chapterList.innerHTML = '<div style="padding: 20px; color: #86868b; text-align: center;">Lỗi tải dữ liệu. Hãy kiểm tra kết nối Server.</div>';
    }
}

async function loadLessonDetail(lessonId, element) {
    document.querySelectorAll('.lesson-item').forEach(el => el.classList.remove('active'));
    element.classList.add('active');
    currentLessonId = lessonId;

    try {
        const response = await fetch(`${API_BASE_URL}/lessons/${lessonId}`);
        if (!response.ok) throw new Error("API lỗi");
        const lesson = await response.json();

        document.getElementById('lessonTitle').value = lesson.title || '';
        document.getElementById('lessonOrder').value = lesson.order_num || '';
        document.getElementById('lessonSections').value = lesson.sections_count || '';
        document.getElementById('lessonDifficulty').value = lesson.difficulty || 'Trung bình';
        document.querySelector('.textarea-recap').value = lesson.recap_text || '';
        document.getElementById('mainContentEditor').innerHTML = lesson.html_content || '<p>Nhập nội dung...</p>';

        // Load Huy chương Bài học
        try {
            currentSelectedMedals = lesson.medal_url ? JSON.parse(lesson.medal_url) : [];
            if (!Array.isArray(currentSelectedMedals)) currentSelectedMedals = lesson.medal_url ? [lesson.medal_url] : [];
        } catch (e) {
            currentSelectedMedals = lesson.medal_url ? [lesson.medal_url] : [];
        }
        renderSelectedMedals();

        // Load Bản đồ
        mapScriptData = lesson.geojson_data ? JSON.parse(lesson.geojson_data) : {};
        
        // Load Nhân vật
        charScriptData = lesson.characters_data ? JSON.parse(lesson.characters_data) : {};
        
        document.getElementById('mapOverlay').classList.remove('hidden');
        currentActiveGeoId = null;
        mapFeatureGroup.clearLayers();

    } catch (error) { console.error("Lỗi:", error); }
}

async function saveLessonContent() {
    if (!currentLessonId) { showAdminToast("Vui lòng chọn bài học trước!", "error"); return; }

    const payload = {
        title: document.getElementById('lessonTitle').value,
        order_num: document.getElementById('lessonOrder').value,
        sections_count: document.getElementById('lessonSections').value,
        difficulty: document.getElementById('lessonDifficulty').value,
        recap_text: document.querySelector('.textarea-recap').value,
        html_content: document.getElementById('mainContentEditor').innerHTML,
        geojson_data: JSON.stringify(mapScriptData),
        characters_data: JSON.stringify(charScriptData),
        medal_url: JSON.stringify(currentSelectedMedals)
    };

    const btnSave = document.querySelector('.apple-btn-primary');
    btnSave.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Đang lưu...';

    try {
        const response = await fetch(`${API_BASE_URL}/lessons/${currentLessonId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (response.ok) {
            btnSave.innerHTML = '<i class="fa-solid fa-check"></i> Đã lưu';
            showAdminToast("Đã lưu dữ liệu bài học thành công!");
            setTimeout(() => { btnSave.innerHTML = '<i class="fa-solid fa-cloud-arrow-up"></i> Lưu thay đổi'; }, 2000);
            loadRoadmapTree(); 
        }
    } catch (error) {
        showAdminToast("Lưu thất bại! Mất kết nối máy chủ.", "error");
        btnSave.innerHTML = '<i class="fa-solid fa-cloud-arrow-up"></i> Lưu thay đổi';
    }
}

async function deleteCurrentLesson() {
    if (!currentLessonId) { showAdminToast("Chưa có bài học nào được chọn!", "error"); return; }
    
    if (confirm("Bạn có chắc chắn muốn XÓA VĨNH VIỄN bài học này?")) {
        try {
            const res = await fetch(`${API_BASE_URL}/lessons/${currentLessonId}`, { method: 'DELETE' });
            if (res.ok) {
                showAdminToast("Đã xóa bài học thành công!");
                currentLessonId = null;
                document.getElementById('lessonTitle').value = '';
                document.getElementById('mainContentEditor').innerHTML = '<p>Vui lòng chọn bài học ở cột trái để chỉnh sửa...</p>';
                loadRoadmapTree();
            }
        } catch(e) { showAdminToast("Lỗi khi xóa bài học!", "error"); }
    }
}

async function deleteChapter(event, chapterId) {
    event.stopPropagation();
    if (confirm("CẢNH BÁO: Xóa chương sẽ XÓA SẠCH toàn bộ bài học nằm bên trong nó. Vẫn tiếp tục?")) {
        try {
            const res = await fetch(`${API_BASE_URL}/chapters/${chapterId}`, { method: 'DELETE' });
            if (res.ok) {
                showAdminToast("Đã xóa toàn bộ Chương!");
                currentLessonId = null;
                loadRoadmapTree();
            }
        } catch(e) { showAdminToast("Lỗi khi xóa chương!", "error"); }
    }
}

/* ==========================================
   5. CUSTOM MODAL (TẠO MỚI CHƯƠNG/BÀI HỌC)
========================================== */
let currentModalMode = ''; 
let targetChapterIdForLesson = null; 
let editTargetId = null;

function openModal(mode, chapterId = null, chapterName = '', orderNum = '') {
    currentModalMode = mode;
    targetChapterIdForLesson = chapterId;
    editTargetId = chapterId; // Lưu ID để sửa

    const modal = document.getElementById('actionModal');
    
    // Nếu là chế độ 'edit_chapter', điền sẵn tên và số thứ tự cũ vào ô nhập
    if (mode === 'edit_chapter') {
        document.getElementById('modalInputNumber').value = orderNum;
        document.getElementById('modalInputName').value = chapterName;
        document.getElementById('modalTitle').innerText = 'Sửa Chương';
        document.getElementById('modalDesc').innerText = 'Cập nhật thông tin lộ trình.';
    } else {
        // Chế độ tạo mới: Xóa trống ô nhập
        document.getElementById('modalInputNumber').value = '';
        document.getElementById('modalInputName').value = '';
        
        if (mode === 'chapter') {
            document.getElementById('modalTitle').innerText = 'Tạo Chương Mới';
            document.getElementById('modalDesc').innerText = 'Nhập thông tin lộ trình.';
        } else {
            document.getElementById('modalTitle').innerText = 'Tạo Bài Học Mới';
            document.getElementById('modalDesc').innerText = `Thuộc: ${chapterName}`;
        }
    }
    
    modal.classList.add('show');
}
function closeModal() { document.getElementById('actionModal').classList.remove('show'); }
function createNewChapter() { openModal('chapter'); }
function createNewLesson(event, chapterId, chapterName) {
    event.stopPropagation();
    openModal('lesson', chapterId, chapterName);
}

// Hàm mới: Bắt sự kiện khi bấm nút Cây bút
function editChapterName(event, chapterId, chapterName, orderNum) {
    event.stopPropagation();
    openModal('edit_chapter', chapterId, chapterName, orderNum);
}

async function submitModal() {
    const inputNum = document.getElementById('modalInputNumber').value;
    const inputName = document.getElementById('modalInputName').value.trim();
    if (!inputNum || !inputName) return showAdminToast("Vui lòng điền đủ thông tin!", "error");

    const btnSubmit = document.getElementById('btnModalSubmit');
    btnSubmit.innerHTML = 'Đang xử lý...'; btnSubmit.disabled = true;

    try {
        if (currentModalMode === 'chapter') {
            await fetch(`${API_BASE_URL}/chapters`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: inputName, order_num: parseInt(inputNum) })
            });
            showAdminToast("Tạo Chương mới thành công!");
            
        } else if (currentModalMode === 'edit_chapter') {
            // GỌI API SỬA CHƯƠNG (PHƯƠNG THỨC PUT)
            await fetch(`${API_BASE_URL}/chapters/${editTargetId}`, {
                method: 'PUT', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: inputName, order_num: parseInt(inputNum) })
            });
            showAdminToast("Đã cập nhật thông tin Chương!");
            
        } else {
            await fetch(`${API_BASE_URL}/lessons`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ chapter_id: targetChapterIdForLesson, title: inputName, order_num: parseInt(inputNum) })
            });
            showAdminToast("Tạo Bài học mới thành công!");
        }
        closeModal(); loadRoadmapTree(); // Cập nhật lại danh sách cột trái
    } catch (e) { showAdminToast("Lỗi kết nối API!", "error"); } 
    finally { btnSubmit.innerHTML = 'Xác Nhận'; btnSubmit.disabled = false; }
}

/* ==========================================
   6. BẢN ĐỒ GEOMAP & TÔ MÀU ĐỘC LẬP
========================================== */
function createColoredIcon(color) {
    return L.divIcon({
        className: 'custom-colored-marker',
        html: `<div style="background-color: ${color}; width: 14px; height: 14px; border-radius: 50%; border: 2px solid white; box-shadow: 0 0 10px ${color}; margin-top: -7px; margin-left: -7px;"></div>`,
        iconSize: [0, 0] 
    });
}

function initAdminMap() {
    adminMapInstance = L.map('adminGeoMap').setView([16.047, 108.206], 5);
    L.tileLayer('https://mt1.google.com/vt/lyrs=p&x={x}&y={y}&z={z}&hl=vi&gl=VN').addTo(adminMapInstance); 

    const defaultColor = document.getElementById('geoRegionColor').value;
    adminMapInstance.pm.setPathOptions({ color: defaultColor, fillColor: defaultColor, fillOpacity: 0.35, weight: 2.5 });

    adminMapInstance.pm.addControls({
        position: 'topleft', 
        drawMarker: true, 
        drawCircleMarker: false, drawPolyline: false,
        drawRectangle: true, drawPolygon: true, drawCircle: false, 
        editMode: true, dragMode: true, removalMode: true
    });

    mapFeatureGroup = new L.FeatureGroup();
    adminMapInstance.addLayer(mapFeatureGroup);

    adminMapInstance.on('pm:create', (e) => { 
        const layer = e.layer;
        const currentColor = document.getElementById('geoRegionColor').value;
        
        if (e.shape === 'Marker') {
            layer.setIcon(createColoredIcon(currentColor));
        } else {
            layer.setStyle({ color: currentColor, fillColor: currentColor });
        }
        
        layer.feature = layer.feature || { type: 'Feature', properties: {} };
        layer.feature.properties.themeColor = currentColor;

        layer.on('click', () => { selectShape(layer); });
        
        mapFeatureGroup.addLayer(layer); 
        syncMapData(); 
    });

    adminMapInstance.on('pm:remove', syncMapData);
    adminMapInstance.on('pm:update', syncMapData);
}

function selectShape(layer) {
    selectedShape = layer;
    if (layer.feature && layer.feature.properties) {
        if(layer.feature.properties.themeColor) document.getElementById('geoRegionColor').value = layer.feature.properties.themeColor;
        document.getElementById('geoRegionName').value = layer.feature.properties.regionName || '';
        document.getElementById('geoRegionNote').value = layer.feature.properties.regionNote || ''; 
    }
}

function changeSelectedShapeColor() {
    const newColor = document.getElementById('geoRegionColor').value;
    adminMapInstance.pm.setPathOptions({ color: newColor, fillColor: newColor });

    if (selectedShape) {
        if (selectedShape instanceof L.Marker) {
            selectedShape.setIcon(createColoredIcon(newColor));
        } else {
            selectedShape.setStyle({ color: newColor, fillColor: newColor });
        }
        selectedShape.feature.properties.themeColor = newColor; 
        syncMapData();
    }
}

function markGeoKeyword() {
    const selection = window.getSelection();
    const selectedText = selection.toString();
    if (!selection.rangeCount || selectedText.trim() === '') return showAdminToast("Vui lòng bôi đen một cụm từ để làm Geo-Keyword!", "error");

    const uniqueGeoId = 'geo_' + Date.now();
    document.execCommand('insertHTML', false, `<span class="geo-keyword" data-geo-id="${uniqueGeoId}">${selectedText}</span>`);
    mapScriptData[uniqueGeoId] = null; 
}

function activateGeoKeyword(keywordElement) {
    document.querySelectorAll('.geo-keyword').forEach(el => el.classList.remove('active-keyword'));
    keywordElement.classList.add('active-keyword');

    currentActiveGeoId = keywordElement.getAttribute('data-geo-id');
    document.getElementById('lblActiveKeyword').innerText = keywordElement.innerText;
    document.getElementById('mapOverlay').classList.add('hidden'); 
    
    setTimeout(() => { adminMapInstance.invalidateSize(); }, 300);
    loadMapDataForCurrentKeyword();
}

function loadMapDataForCurrentKeyword() {
    mapFeatureGroup.clearLayers();
    selectedShape = null; 
    document.getElementById('geoRegionName').value = '';
    document.getElementById('geoRegionNote').value = '';

    const existingData = mapScriptData[currentActiveGeoId];
    if (existingData) {
        if (existingData.features.length > 0 && existingData.features[0].properties) {
            document.getElementById('geoRegionName').value = existingData.features[0].properties.regionName || '';
            document.getElementById('geoRegionNote').value = existingData.features[0].properties.regionNote || '';
        }
        L.geoJSON(existingData, { 
            pointToLayer: function (feature, latlng) {
                const color = feature.properties.themeColor || '#dc2626';
                return L.marker(latlng, { icon: createColoredIcon(color) });
            },
            style: function(feature) {
                const color = feature.properties.themeColor || '#dc2626';
                return { color: color, fillColor: color, fillOpacity: 0.35, weight: 2.5, dashArray: '5, 8' };
            },
            onEachFeature: function (feature, layer) { 
                layer.on('click', () => { selectShape(layer); });
                mapFeatureGroup.addLayer(layer); 
            }
        });

        if (mapFeatureGroup.getLayers().length > 0) {
            const bounds = mapFeatureGroup.getBounds();
            if (bounds.getNorthEast().equals(bounds.getSouthWest())) {
                adminMapInstance.flyTo(bounds.getCenter(), 8, { duration: 1.5 }); 
            } else {
                adminMapInstance.flyToBounds(bounds, { padding: [30, 30], duration: 1.5 }); 
            }
        }
    }
}

function syncMapData() {
    if (!currentActiveGeoId) return;
    
    const features = [];
    
    mapFeatureGroup.eachLayer(layer => {
        const geoJson = layer.toGeoJSON();
        
        let shapeColor = '#dc2626';
        if (layer instanceof L.Marker) {
            shapeColor = layer.feature?.properties?.themeColor || document.getElementById('geoRegionColor').value || '#dc2626';
        } else {
            shapeColor = layer.options.color || document.getElementById('geoRegionColor').value || '#dc2626'; 
        }

        let centerCoord = [0, 0];
        if (layer instanceof L.Marker) {
            const latlng = layer.getLatLng();
            centerCoord = [latlng.lat, latlng.lng];
        } else if (layer.getBounds) {
            const center = layer.getBounds().getCenter();
            centerCoord = [center.lat, center.lng];
        }

        geoJson.properties = {
            regionName: document.getElementById('geoRegionName').value,
            regionNote: document.getElementById('geoRegionNote').value,
            themeColor: shapeColor, 
            center: centerCoord
        };
        
        features.push(geoJson);
    });

    mapScriptData[currentActiveGeoId] = {
        type: "FeatureCollection",
        features: features
    };
}

window.saveMapSettings = function() {
    if (!currentActiveGeoId) {
        showAdminToast("Vui lòng chọn một chữ màu vàng (Geo-Keyword) trước!", "error");
        return;
    }
    if (mapFeatureGroup.getLayers().length === 0) {
        showAdminToast("Vui lòng chấm ít nhất 1 điểm hoặc vẽ 1 vùng trên bản đồ!", "error");
        return;
    }
    
    syncMapData();
    showAdminToast("Đã chốt xong tọa độ và mô tả cho cứ điểm này!");
};

/* ==========================================
   7. RICH TEXT EDITOR
========================================== */
function formatText(command, value = null) {
    document.execCommand(command, false, value);
    document.getElementById('mainContentEditor').focus();
}

function insertImage() {
    const url = prompt("Nhập đường dẫn URL ảnh:");
    if (url) {
        const imgHTML = `<img src="${url}" style="max-width: 100%; border-radius: 12px; margin: 20px auto; display: block; box-shadow: 0 4px 15px rgba(0,0,0,0.1);">`;
        document.execCommand('insertHTML', false, imgHTML);
    }
}

/* ==========================================
   8. HỆ THỐNG NHÂN VẬT & THẺ BÀI (CHAR-KEYWORD)
========================================== */
function markCharacterKeyword() {
    const selection = window.getSelection();
    const text = selection.toString();
    if (!selection.rangeCount || text.trim() === '') return showAdminToast("Vui lòng bôi đen tên nhân vật!", "error");

    const uniqueId = 'char_' + Date.now();
    document.execCommand('insertHTML', false, `<span class="char-keyword" data-char-id="${uniqueId}">${text}</span>`);
    
    charScriptData[uniqueId] = { name: text, years: '', hometown: '', info: '', medalUrl: '' };
}



function activateCharKeyword(element) {
    currentActiveCharId = element.getAttribute('data-char-id');
    const data = charScriptData[currentActiveCharId] || {};

    document.getElementById('charName').value = data.name || element.innerText;
    document.getElementById('charYears').value = data.years || '';
    document.getElementById('charHometown').value = data.hometown || '';
    document.getElementById('charInfo').value = data.info || '';
    
    const preview = document.getElementById('charMedalPreview');
    const placeholder = document.getElementById('charMedalPlaceholder');
    
    if (data.medalUrl) {
        preview.src = data.medalUrl;
        preview.style.display = 'block';
        placeholder.style.display = 'none';
    } else {
        preview.style.display = 'none';
        placeholder.style.display = 'flex';
    }
    document.getElementById('charSelectedMedalUrl').value = data.medalUrl || '';

    document.getElementById('characterModal').classList.add('show');
}

function closeCharacterModal() {
    document.getElementById('characterModal').classList.remove('show');
    currentActiveCharId = null;
}

function saveCharacterData() {
    if(!currentActiveCharId) return;
    
    charScriptData[currentActiveCharId] = {
        name: document.getElementById('charName').value,
        years: document.getElementById('charYears').value,
        hometown: document.getElementById('charHometown').value,
        info: document.getElementById('charInfo').value,
        medalUrl: document.getElementById('charSelectedMedalUrl').value
    };
    
    closeCharacterModal();
    showAdminToast("Đã lưu hồ sơ nhân vật (Nhớ bấm Lưu Bài Học để lưu vào Database)!");
}

/* ==========================================
   9. QUẢN LÝ TÀI KHOẢN ADMIN & HỆ THỐNG HEARTBEAT
========================================== */
document.addEventListener('DOMContentLoaded', () => {
    const profileBtn = document.querySelector('.admin-profile');
    if (profileBtn) {
        profileBtn.style.cursor = 'pointer'; 
        profileBtn.title = "Bấm để quản lý tài khoản";
        profileBtn.addEventListener('click', openAdminManagement);
    }

    // KHỞI ĐỘNG MÁY ĐẾM NHỊP TIM ONLINE (HEARTBEAT)
    // Cứ mỗi 1 phút (60000ms), bắn tín hiệu lên Server để cộng thêm 1 phút làm việc
    setInterval(async () => {
        if (adminUserStr) {
            try {
                const adminUser = JSON.parse(adminUserStr);
                await fetch(`${API_BASE_URL}/admin/heartbeat`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email: adminUser.email })
                });
            } catch (e) { console.log("Heartbeat lỗi mạng ngầm"); }
        }
    }, 60000); 
});

async function openAdminManagement() {
    document.getElementById('adminManagementModal').classList.add('show');
    const tbody = document.getElementById('adminTableBody');
    
    tbody.innerHTML = '<tr><td colspan="3" style="text-align: center; padding: 20px; color: #64748b;"><i class="fa-solid fa-spinner fa-spin"></i> Đang tải dữ liệu thực...</td></tr>';
    
    try {
        const response = await fetch(`${API_BASE_URL}/admin/list`);
        const result = await response.json();
        
        if (result.status === 'success') {
            let html = '';
            
            result.admins.forEach(admin => {
                // Định dạng phút thành Giờ & Phút cực chuẩn
                const totalMins = admin.total_online_minutes || 0;
                const hours = Math.floor(totalMins / 60);
                const mins = totalMins % 60;
                
                let displayTime = "Vừa tham gia";
                if (totalMins > 0) {
                    if (hours > 0) displayTime = `${hours}h ${mins}p`;
                    else displayTime = `${mins} phút`;
                }

                let isMe = '';
                if (adminUserStr) {
                    const myInfo = JSON.parse(adminUserStr);
                    if (myInfo.email === admin.email) isMe = ' <span style="background:#fef2f2; color:#b91c1c; padding: 2px 6px; border-radius:10px; font-size:0.7rem;">(Bạn)</span>';
                }

                html += `
                <tr style="border-bottom: 1px solid #f1f5f9;">
                    <td style="padding: 12px; font-weight: 600; color: #1e293b; display: flex; align-items: center; gap: 10px;">
                        <img src="https://ui-avatars.com/api/?name=${encodeURIComponent(admin.full_name)}&background=b91c1c&color=fff" style="width: 28px; height: 28px; border-radius: 50%;"> 
                        ${admin.full_name} ${isMe}
                    </td>
                    <td style="padding: 12px; font-size: 0.9rem; color: #3b82f6; font-weight: 600;">Ban Chỉ Huy</td>
                    <td style="padding: 12px; font-size: 0.9rem; color: #10b981; font-weight: bold;">
                        <i class="fa-solid fa-bolt" style="color:#f59e0b"></i> ${displayTime}
                    </td>
                </tr>
                `;
            });
            
            tbody.innerHTML = html;
        }
    } catch (e) {
        tbody.innerHTML = '<tr><td colspan="3" style="text-align: center; color: #dc2626; padding: 20px;">Lỗi tải dữ liệu máy chủ!</td></tr>';
    }
}

function closeAdminManagement() {
    document.getElementById('adminManagementModal').classList.remove('show');
}

function adminLogout() {
    if(confirm("Bạn có chắc chắn muốn rời khỏi Trạm Chỉ Huy?")) {
        localStorage.removeItem('admin_session');
        localStorage.removeItem('admin_user');
        window.location.href = 'admin.html';
    }
}

/* ========================================================================= */
/* ENGINE QUẢN LÝ POSTCARD VIDEO (TÍCH HỢP TRỰC TIẾP)                        */
/* ========================================================================= */
let pcActiveLessonId = null;

// Khởi tạo Sidebar bằng dữ liệu từ API Roadmap
async function initPostcardModule() {
    const listDiv = document.getElementById('pcLessonList');
    try {
        const res = await fetch(`${API_BASE_URL}/roadmap`);
        const data = await res.json();
        
        if (data.status === 'success') {
            listDiv.innerHTML = '';
            data.chapters.forEach(chapter => {
                let lessonsHTML = '';
                chapter.lessons.forEach(lesson => {
                    lessonsHTML += `<div class="lesson-item pc-item" id="pc_item_${lesson.id}" onclick="selectPostcardLesson(${lesson.id}, '${lesson.title}', this)">
                        <i class="fa-solid fa-file-video"></i> ${lesson.title}
                    </div>`;
                });
                listDiv.innerHTML += `
                    <div class="tree-chapter expanded">
                        <div class="chapter-header" onclick="toggleChapter(this)">
                            <i class="fa-solid fa-chevron-down arrow"></i>
                            <i class="fa-solid fa-folder folder-icon"></i>
                            <span>${chapter.name}</span>
                        </div>
                        <div class="chapter-lessons">${lessonsHTML}</div>
                    </div>`;
            });
        }
    } catch (e) {
        listDiv.innerHTML = '<div style="padding:20px; color:#dc2626; text-align:center;">Lỗi tải dữ liệu Roadmap!</div>';
    }
}
// Bấm vào 1 bài học trên Sidebar
async function selectPostcardLesson(lessonId, title, element) {
    document.querySelectorAll('.pc-item').forEach(el => el.classList.remove('active'));
    element.classList.add('active');
    pcActiveLessonId = lessonId;

    document.getElementById('pcBreadcrumb').innerHTML = `<i class="fa-solid fa-photo-film"></i> Bài: ${title}`;
    document.getElementById('pcEmptyState').style.display = 'none';
    document.getElementById('pcEditorContent').style.display = 'block';
    document.getElementById('btnSavePostcard').disabled = false;
    document.getElementById('pcSyncedContent').value = "Đang đồng bộ dữ liệu...";

    // RESET Form
    document.getElementById('pcFileSelector').value = "";
    document.getElementById('pcMediaFilename').value = "";
    document.getElementById('pcImageUrl').value = "";
    triggerPCImage("");
    triggerPCMedia("");

    try {
        const resLesson = await fetch(`${API_BASE_URL}/lessons/${lessonId}`);
        if(resLesson.ok) {
            const lessonData = await resLesson.json();
            document.getElementById('pcSyncedContent').value = lessonData.recap_text || "Bài học này chưa có Tóm tắt (Recap).";
        }

        const resPc = await fetch(`${API_BASE_URL}/postcard/${lessonId}`);
        if(resPc.ok) {
            const pcData = await resPc.json();
            if(pcData.status === 'success') {
                // Hiển thị dữ liệu cũ nếu đã từng lưu
                if(pcData.data.video_filename) {
                    document.getElementById('pcMediaFilename').value = pcData.data.video_filename;
                    triggerPCMedia(pcData.data.video_filename);
                }
                if(pcData.data.image_url) {
                    document.getElementById('pcImageUrl').value = pcData.data.image_url;
                    triggerPCImage(pcData.data.image_url);
                }
            }
        }
    } catch(e) { console.error("Lỗi lấy dữ liệu Postcard:", e); }
}

// Xử lý khi chọn file từ máy tính
// Xử lý khi chọn file từ máy tính (ĐÃ FIX: Thêm thông báo nhắc nhở Upload)
function handlePCFileSelect(input) {
    if (input.files && input.files[0]) {
        const file = input.files[0];
        
        // Xác định là video hay audio dựa trên đuôi file
        const isVideo = file.name.toLowerCase().endsWith('.mp4');
        const prefix = isVideo ? 'videos/' : 'audios/';
        const finalPath = prefix + file.name;
        
        // Ghi đường dẫn vào ô Input để lưu vào Database
        document.getElementById('pcMediaFilename').value = finalPath;
        
        // Tạo đường dẫn ảo để phát ngay lập tức
        const localPreviewUrl = URL.createObjectURL(file);
        triggerPCMedia(finalPath, localPreviewUrl);

        // BỔ SUNG: Bắn thông báo nhắc Admin phải tự copy file vào source code
        if (typeof showAdminToast === 'function') {
            showAdminToast(`Lưu ý: Bạn phải tự copy file "${file.name}" bỏ vào thư mục "${prefix}" của code nhé!`);
        }
    }
}
// Cập nhật trình phát Ảnh
function triggerPCImage(url) {
    const preview = document.getElementById('pcImagePreview');
    const placeholder = document.getElementById('pcImagePlaceholder');
    if (url && url.trim() !== '') {
        preview.src = url;
        preview.style.display = 'block';
        placeholder.style.display = 'none';
    } else {
        preview.src = '';
        preview.style.display = 'none';
        placeholder.style.display = 'block';
    }
}

// Cập nhật trình phát MP3 / MP4
function triggerPCMedia(dbPath, localPreviewUrl = null) {
    const audioPlayer = document.getElementById('pcAudioPlayer');
    const videoPlayer = document.getElementById('pcVideoPlayer');
    const placeholder = document.getElementById('pcMediaPlaceholder');
    
    // Tắt và ẩn cả 2 trình phát trước khi nạp bài mới
    audioPlayer.style.display = 'none'; 
    videoPlayer.style.display = 'none';
    audioPlayer.pause(); 
    videoPlayer.pause();

    if (dbPath && dbPath.trim() !== "") {
        placeholder.style.display = 'none';
        
        // Ưu tiên phát link ảo (nếu vừa chọn file từ máy), ngược lại thì phát link từ DB
        const playUrl = localPreviewUrl ? localPreviewUrl : dbPath;
        
        if (dbPath.toLowerCase().endsWith('.mp4')) {
            videoPlayer.src = playUrl;
            videoPlayer.style.display = 'block';
            videoPlayer.load(); // BẮT BUỘC PHẢI LOAD ĐỂ NẠP FILE MỚI
        } else {
            audioPlayer.src = playUrl;
            audioPlayer.style.display = 'block';
            audioPlayer.load(); // BẮT BUỘC PHẢI LOAD ĐỂ NẠP FILE MỚI
        }
    } else {
        placeholder.style.display = 'block';
    }
}

// Lưu Database
async function savePostcardConfig() {
    if (!pcActiveLessonId) return;
    
    const mediaFilename = document.getElementById('pcMediaFilename').value;
    const imageUrl = document.getElementById('pcImageUrl').value;
    
    const btn = document.getElementById('btnSavePostcard');
    const originalHTML = btn.innerHTML;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Đang lưu...';
    btn.disabled = true;

    try {
        const res = await fetch(`${API_BASE_URL}/postcard`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                lesson_id: String(pcActiveLessonId), 
                video_filename: mediaFilename,
                image_url: imageUrl 
            })
        });
        const result = await res.json();
        
        if (res.ok && result.status === 'success') {
            showAdminToast("Lưu cấu hình Postcard thành công!");
            btn.innerHTML = '<i class="fa-solid fa-check"></i> Đã lưu';
        } else {
            showAdminToast("Lỗi máy chủ!", "error");
        }
    } catch (error) {
        showAdminToast("Lỗi kết nối mạng!", "error");
    } finally {
        setTimeout(() => { btn.innerHTML = originalHTML; btn.disabled = false; }, 2000);
    }
}

/* ========================================================================= */
/* HỆ THỐNG KÉO THẢ ẢNH BẰNG 4 CHẤM TRÒN (DRAG TO RESIZE)                    */
/* ========================================================================= */
/* ========================================================================= */
/* HỆ THỐNG KÉO THẢ ẢNH BẰNG 4 CHẤM TRÒN (DRAG TO RESIZE)                    */
/* ========================================================================= */

let activeResizingImage = null;
let resizerOverlay = null;
let isDraggingResizer = false;
let startX, startY, startWidth, startHeight, currentDot;

// 1. Tạo Overlay 4 góc (Có cơ chế tự phục hồi)
function createResizerOverlay() {
    let overlay = document.getElementById('imgResizerOverlay');
    
    if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = 'imgResizerOverlay';
        overlay.className = 'img-resizer-overlay';
        
        overlay.addEventListener('click', (e) => e.stopPropagation());
        
        const positions = ['top-left', 'top-right', 'bottom-left', 'bottom-right'];
        positions.forEach(pos => {
            const dot = document.createElement('div');
            dot.className = `resizer-dot ${pos}`;
            dot.dataset.position = pos;
            dot.addEventListener('mousedown', initDragResize);
            overlay.appendChild(dot);
        });
    }
    
    const editor = document.getElementById('mainContentEditor');
    if (!editor.contains(overlay)) {
        editor.appendChild(overlay);
    }
    resizerOverlay = overlay;
}

// 2. Bắt sự kiện Click vào Editor
function initEditorClickListener() {
    const editor = document.getElementById('mainContentEditor');
    
    editor.addEventListener('click', (e) => {
        if (e.target.classList.contains('geo-keyword')) activateGeoKeyword(e.target);
        if (e.target.classList.contains('char-keyword')) activateCharKeyword(e.target);
        
        if (e.target.tagName === 'IMG') {
            createResizerOverlay(); 
            activeResizingImage = e.target;
            updateResizerOverlayPosition();
        } else if (!e.target.classList.contains('resizer-dot') && e.target.id !== 'imgResizerOverlay') {
            hideResizerOverlay();
        }
    });

    editor.addEventListener('input', updateResizerOverlayPosition);
    editor.addEventListener('scroll', updateResizerOverlayPosition);
}

// 3. Tính toán vị trí và ốp khung lưới lên tấm ảnh
function updateResizerOverlayPosition() {
    if (!activeResizingImage || !resizerOverlay) return;
    
    const editor = document.getElementById('mainContentEditor');
    const editorRect = editor.getBoundingClientRect();
    const imgRect = activeResizingImage.getBoundingClientRect();
    
    const top = imgRect.top - editorRect.top + editor.scrollTop;
    const left = imgRect.left - editorRect.left + editor.scrollLeft;
    
    resizerOverlay.style.top = `${top}px`;
    resizerOverlay.style.left = `${left}px`;
    resizerOverlay.style.width = `${imgRect.width}px`;
    resizerOverlay.style.height = `${imgRect.height}px`;
    resizerOverlay.style.display = 'block';
}

function hideResizerOverlay() {
    if (resizerOverlay) resizerOverlay.style.display = 'none';
    activeResizingImage = null;
}

// 4. Thuật toán xử lý chuột khi nắm kéo
function initDragResize(e) {
    e.preventDefault(); 
    isDraggingResizer = true;
    currentDot = e.target.dataset.position;
    
    startX = e.clientX;
    startY = e.clientY;
    startWidth = activeResizingImage.getBoundingClientRect().width;
    
    document.addEventListener('mousemove', doDragResize);
    document.addEventListener('mouseup', stopDragResize);
}

function doDragResize(e) {
    if (!isDraggingResizer || !activeResizingImage) return;
    
    let dx = e.clientX - startX;
    let dy = e.clientY - startY;
    
    let distanceX = currentDot.includes('right') ? dx : -dx;
    let distanceY = currentDot.includes('bottom') ? dy : -dy;
    
    let widthChange = Math.abs(distanceX) > Math.abs(distanceY) ? distanceX : distanceY;

    const imgStyle = window.getComputedStyle(activeResizingImage);
    const isCentered = (imgStyle.marginLeft === 'auto' && imgStyle.marginRight === 'auto') || activeResizingImage.parentElement.style.textAlign === 'center';
    
    if (isCentered) {
        widthChange = widthChange * 2; 
    }

    let newWidth = startWidth + widthChange;
    
    if (newWidth > 50) {
        activeResizingImage.style.width = `${newWidth}px`;
        activeResizingImage.style.height = 'auto'; 
        updateResizerOverlayPosition();
    }
}

function stopDragResize() {
    isDraggingResizer = false;
    document.removeEventListener('mousemove', doDragResize);
    document.removeEventListener('mouseup', stopDragResize);
}
