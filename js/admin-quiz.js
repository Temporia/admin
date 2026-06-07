/* ========================================================================= */
/* ENGINE QUẢN LÝ QUIZ - AUTO SYNC LỘ TRÌNH & ĐẺ CÂU HỎI TỰ ĐỘNG           */
/* ========================================================================= */

let currentQuizMode = 'lesson'; // 'lesson' hoặc 'contest'
let currentActiveTargetId = null; 

document.addEventListener('DOMContentLoaded', () => {
    // Không tải ngay, chờ khi nào user bấm sang tab Quiz mới tải cho nhẹ web
});

// Được gọi khi bấm nút Tab bên Menu Trái
function switchQuizMode(mode) {
    currentQuizMode = mode;
    document.getElementById('tabQuizLesson').classList.remove('active');
    document.getElementById('tabQuizContest').classList.remove('active');
    
    document.getElementById('quizEmptyState').style.display = 'flex';
    document.getElementById('quizEditorPanel').style.display = 'none';
    currentActiveTargetId = null;

    if (mode === 'lesson') {
        document.getElementById('tabQuizLesson').classList.add('active');
        document.getElementById('btnCreateContest').style.display = 'none';
        document.querySelectorAll('.contest-only').forEach(el => el.style.display = 'none');
        document.getElementById('lblQuizTitle').innerText = 'Tiêu đề Bài tập';
        fetchLessonsForQuizSidebar(); // Tự động đồng bộ từ Lộ trình
    } else {
        document.getElementById('tabQuizContest').classList.add('active');
        document.getElementById('btnCreateContest').style.display = 'block';
        document.querySelectorAll('.contest-only').forEach(el => el.style.display = 'block');
        document.getElementById('lblQuizTitle').innerText = 'Tên Cuộc thi';
        loadContestsForSidebar(); // Tải danh sách cuộc thi
    }
}

// Gọi API Lộ trình để lấy bài học đắp vào Sidebar
async function fetchLessonsForQuizSidebar() {
    const list = document.getElementById('quizSidebarList');
    list.innerHTML = '<div style="text-align:center; padding: 20px; color:#94a3b8;"><i class="fa-solid fa-spinner fa-spin"></i> Đang đồng bộ...</div>';
    
    try {
        const response = await fetch(`${API_BASE_URL}/roadmap`);
        const data = await response.json();
        list.innerHTML = '';

        data.chapters.forEach(chapter => {
            chapter.lessons.forEach(lesson => {
                list.innerHTML += `
                    <div class="quiz-list-item" onclick="openQuizEditor(${lesson.id}, '${lesson.title}')">
                        <i class="fa-solid fa-file-lines"></i>
                        <span style="flex:1;">${lesson.title}</span>
                    </div>
                `;
            });
        });
    } catch(e) {
        list.innerHTML = '<div style="text-align:center; color:#dc2626;">Lỗi đồng bộ dữ liệu</div>';
    }
}

function loadContestsForSidebar() {
    const list = document.getElementById('quizSidebarList');
    // Ở đây sau này sẽ gọi API GET /api/contests. Tạm thời hiển thị tĩnh để thiết kế UI.
    list.innerHTML = `
        <div class="quiz-list-item" onclick="openQuizEditor('c1', 'Cuộc thi: Hào khí Đông A')">
            <i class="fa-solid fa-trophy" style="color: #f59e0b;"></i>
            <span style="flex:1;">Hào khí Đông A</span>
        </div>
    `;
}

function createNewContest() {
    openQuizEditor('new', 'Cuộc thi chưa đặt tên');
    document.getElementById('quizTitle').value = '';
    document.getElementById('quizQCount').value = 5;
    generateQuestionBlocks();
}

// ==============================================================
// CẬP NHẬT HÀM MỞ EDITOR (CÓ TÍNH NĂNG LOAD DỮ LIỆU TỪ DATABASE)
// ==============================================================
window.openQuizEditor = async function(targetId, title) {
    currentActiveTargetId = targetId;
    document.getElementById('quizEmptyState').style.display = 'none';
    document.getElementById('quizEditorPanel').style.display = 'flex';
    document.getElementById('quizBreadcrumb').innerHTML = currentQuizMode === 'lesson' ? `<i class="fa-solid fa-book-open"></i> Bài học: ${title}` : `<i class="fa-solid fa-trophy"></i> Cuộc thi: ${title}`;
    
    // 1. Reset trắng giao diện trước khi tải để tránh lỗi hiển thị chồng chéo
    document.getElementById('quizTitle').value = currentQuizMode === 'lesson' ? "Bài tập: " + title : title;
    document.getElementById('quizQCount').value = 5;
    document.getElementById('quizTimeLimit').value = 15;
    document.getElementById('quizDifficulty').value = 'Trung bình';
    document.getElementById('quizStartDate').value = '';
    document.getElementById('quizEndDate').value = '';
    const container = document.getElementById('questionsContainer');
    container.innerHTML = '<div style="text-align:center; padding: 30px; color: #64748b;"><i class="fa-solid fa-spinner fa-spin fa-2x"></i><p style="margin-top: 10px;">Đang tải dữ liệu Quiz...</p></div>';

    try {
        // 2. Gọi API hỏi Server xem đã có dữ liệu chưa
        const response = await fetch(`${API_BASE_URL}/quiz/${currentQuizMode}/${targetId}`);
        const result = await response.json();

        if (result.status === 'success' && result.data) {
            const data = result.data;
            
            // Đổ dữ liệu Thông tin chung (Metadata)
            document.getElementById('quizTitle').value = data.title || '';
            document.getElementById('quizTimeLimit').value = data.time_limit || 15;
            document.getElementById('quizDifficulty').value = data.difficulty || 'Trung bình';
            
            // Format thời gian ISO sang chuẩn của thẻ <input type="datetime-local">
            if (data.start_time) document.getElementById('quizStartDate').value = data.start_time.slice(0, 16); 
            if (data.end_time) document.getElementById('quizEndDate').value = data.end_time.slice(0, 16);

            // Xử lý dữ liệu câu hỏi (Parse JSON)
            let questions = [];
            try {
                questions = typeof data.questions_data === 'string' ? JSON.parse(data.questions_data) : data.questions_data;
            } catch (e) { questions = []; }

            // Nếu có câu hỏi thì in ra, không có thì gọi hàm tạo rỗng
            if (questions && questions.length > 0) {
                document.getElementById('quizQCount').value = questions.length;
                renderSavedQuestions(questions);
            } else {
                generateQuestionBlocks();
            }
            
        } else {
            // Server trả về 'empty' -> Đây là bài mới tinh, tạo ô trống
            document.getElementById('quizQCount').value = 5;
            generateQuestionBlocks();
        }
    } catch (error) {
        console.error("Lỗi khi tải dữ liệu Quiz:", error);
        container.innerHTML = '<div style="text-align:center; padding: 30px; color: #dc2626;"><i class="fa-solid fa-triangle-exclamation fa-2x"></i><p>Lỗi kết nối đến máy chủ!</p></div>';
    }
};

// ==============================================================
// HÀM VẼ LẠI CÁC CÂU HỎI ĐÃ LƯU
// ==============================================================
function renderSavedQuestions(questions) {
    const container = document.getElementById('questionsContainer');
    let html = '';

    questions.forEach((q, index) => {
        const i = index + 1;
        const opts = q.options || {A:'', B:'', C:'', D:''};
        
        html += `
            <div class="q-card" id="qBlock_${i}">
                <div class="q-card-header">
                    <span>Câu hỏi số ${i}</span>
                    <button class="btn-icon" style="color: #dc2626;" onclick="document.getElementById('qBlock_${i}').remove(); updateQuestionCount();"><i class="fa-solid fa-trash"></i></button>
                </div>
                
                <input type="text" class="apple-input q-main-input" placeholder="Nhập nội dung câu hỏi ${i}..." value="${escapeHTML(q.question_text || '')}">
                <input type="text" class="apple-input" style="margin-bottom: 20px;" placeholder="🔗 URL Hình ảnh minh họa (Để trống nếu không có)..." value="${escapeHTML(q.image_url || '')}">
                
                <div class="answers-grid">
                    <label class="answer-item">
                        <input type="radio" name="correct_ans_${i}" value="A" ${q.correct_ans === 'A' ? 'checked' : ''}>
                        <input type="text" placeholder="Đáp án A" value="${escapeHTML(opts.A || '')}">
                    </label>
                    <label class="answer-item">
                        <input type="radio" name="correct_ans_${i}" value="B" ${q.correct_ans === 'B' ? 'checked' : ''}>
                        <input type="text" placeholder="Đáp án B" value="${escapeHTML(opts.B || '')}">
                    </label>
                    <label class="answer-item">
                        <input type="radio" name="correct_ans_${i}" value="C" ${q.correct_ans === 'C' ? 'checked' : ''}>
                        <input type="text" placeholder="Đáp án C" value="${escapeHTML(opts.C || '')}">
                    </label>
                    <label class="answer-item">
                        <input type="radio" name="correct_ans_${i}" value="D" ${q.correct_ans === 'D' ? 'checked' : ''}>
                        <input type="text" placeholder="Đáp án D" value="${escapeHTML(opts.D || '')}">
                    </label>
                </div>
                
                <textarea class="apple-input explanation-box" rows="2" placeholder="💡 Giải thích đáp án (Học sinh sẽ thấy sau khi nộp bài)...">${escapeHTML(q.explanation || '')}</textarea>
            </div>
        `;
    });
    
    container.innerHTML = html;
}

// Tiện ích làm sạch văn bản (Chống sập giao diện nếu bạn gõ dấu nháy kép/đơn vào ô đáp án)
function escapeHTML(str) {
    if (!str) return '';
    return str.replace(/[&<>'"]/g, 
        tag => ({
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            "'": '&#39;',
            '"': '&quot;'
        }[tag] || tag)
    );
}

// (Giữ nguyên các hàm sinh mới generateQuestionBlocks và saveQuizData bên dưới của bạn nhé...)

// ENGINE TỰ ĐỘNG ĐẺ Ô NHẬP LIỆU CÂU HỎI
function generateQuestionBlocks() {
    const container = document.getElementById('questionsContainer');
    const count = parseInt(document.getElementById('quizQCount').value) || 0;
    
    if (count <= 0 || count > 100) {
        showAdminToast("Số lượng câu hỏi phải từ 1 đến 100!", "error");
        return;
    }

    let html = '';
    for(let i = 1; i <= count; i++) {
        html += `
            <div class="q-card" id="qBlock_${i}">
                <div class="q-card-header">
                    <span>Câu hỏi số ${i}</span>
                    <button class="btn-icon" style="color: #dc2626;" onclick="document.getElementById('qBlock_${i}').remove(); updateQuestionCount();"><i class="fa-solid fa-trash"></i></button>
                </div>
                
                <input type="text" class="apple-input q-main-input" placeholder="Nhập nội dung câu hỏi ${i}...">
                <input type="text" class="apple-input" style="margin-bottom: 20px;" placeholder="🔗 URL Hình ảnh minh họa (Để trống nếu không có)...">
                
                <div class="answers-grid">
                    <label class="answer-item">
                        <input type="radio" name="correct_ans_${i}" value="A" checked>
                        <input type="text" placeholder="Đáp án A">
                    </label>
                    <label class="answer-item">
                        <input type="radio" name="correct_ans_${i}" value="B">
                        <input type="text" placeholder="Đáp án B">
                    </label>
                    <label class="answer-item">
                        <input type="radio" name="correct_ans_${i}" value="C">
                        <input type="text" placeholder="Đáp án C">
                    </label>
                    <label class="answer-item">
                        <input type="radio" name="correct_ans_${i}" value="D">
                        <input type="text" placeholder="Đáp án D">
                    </label>
                </div>
                
                <textarea class="apple-input explanation-box" rows="2" placeholder="💡 Giải thích đáp án (Học sinh sẽ thấy sau khi nộp bài)..."></textarea>
            </div>
        `;
    }
    container.innerHTML = html;
    showAdminToast(`Đã tạo cấu trúc cho ${count} câu hỏi!`);
}

function updateQuestionCount() {
    const currentBlocks = document.querySelectorAll('.q-card').length;
    document.getElementById('quizQCount').value = currentBlocks;
}

function filterQuizList() {
    const q = document.getElementById('searchQuizList').value.toLowerCase();
    const items = document.querySelectorAll('.quiz-list-item');
    items.forEach(item => {
        const text = item.innerText.toLowerCase();
        item.style.display = text.includes(q) ? 'flex' : 'none';
    });
}

async function saveQuizData() {
    if(!currentActiveTargetId) return;
    
    const btn = document.querySelector('#quizEditorPanel .apple-btn-primary');
    const originalText = btn.innerHTML;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Đang lưu...';
    btn.disabled = true;

    // 1. Gói ghém Thông tin Metadata
    const payload = {
        target_type: currentQuizMode,
        target_id: currentActiveTargetId.toString(),
        title: document.getElementById('quizTitle').value.trim(),
        time_limit: parseInt(document.getElementById('quizTimeLimit').value) || 15,
        difficulty: document.getElementById('quizDifficulty').value,
        start_time: document.getElementById('quizStartDate').value || null,
        end_time: document.getElementById('quizEndDate').value || null,
        questions_data: []
    };

    // 2. Đi từng Thẻ câu hỏi để cào dữ liệu
    const qCards = document.querySelectorAll('.q-card');
    qCards.forEach((card, index) => {
        const inputs = card.querySelectorAll('input[type="text"]');
        const radios = card.querySelectorAll('input[type="radio"]');
        const explanation = card.querySelector('.explanation-box').value;

        // Tìm xem Admin tick vào đáp án nào (A, B, C hay D)
        let correctAns = 'A';
        radios.forEach(radio => { if(radio.checked) correctAns = radio.value; });

        payload.questions_data.push({
            id: index + 1,
            question_text: inputs[0].value.trim(),
            image_url: inputs[1].value.trim(),
            options: {
                A: inputs[2].value.trim(),
                B: inputs[3].value.trim(),
                C: inputs[4].value.trim(),
                D: inputs[5].value.trim()
            },
            correct_ans: correctAns,
            explanation: explanation.trim()
        });
    });

    // 3. Bắn thẳng lên API
    try {
        const response = await fetch(`${API_BASE_URL}/quiz`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if(response.ok) {
            btn.innerHTML = '<i class="fa-solid fa-check"></i> Đã lưu thành công';
            if(typeof showAdminToast === 'function') showAdminToast("Dữ liệu Quiz đã được lưu!");
        } else {
            throw new Error("Lỗi API");
        }
    } catch(e) {
        btn.innerHTML = '<i class="fa-solid fa-xmark"></i> Lỗi máy chủ';
        if(typeof showAdminToast === 'function') showAdminToast("Không thể lưu Quiz!", "error");
    }

    // Trả lại trạng thái nút
    setTimeout(() => { btn.innerHTML = originalText; btn.disabled = false; }, 2000);
}