/* ========================================================================= */
/* JS ĐIỀU KHIỂN AUTH - TEMPORIA ADMIN (TÍCH HỢP OTP & BẢO MẬT ĐẦY ĐỦ)       */
/* ========================================================================= */
const API_BASE_URL = 'https://temporia-api.onrender.com/api';

let tempRegEmail = ""; 
let tempRecoveryEmail = ""; 

function switchTab(mode) {
    const slider = document.getElementById('segmentSlider');
    const segmentNav = document.getElementById('segmentNav');
    const subtitle = document.getElementById('authSubtitle');
    
    // Danh sách tất cả các Form
    const forms = {
        login: document.getElementById('loginForm'),
        register: document.getElementById('registerForm'),
        verify: document.getElementById('verifyForm'),
        forgot: document.getElementById('forgotForm'),
        reset: document.getElementById('resetForm')
    };

    // Tắt hiển thị tất cả
    Object.values(forms).forEach(form => form.classList.add('hidden'));

    // Chuyển UI thanh trượt gạt
    if (mode === 'login' || mode === 'register') {
        segmentNav.style.display = 'flex';
        document.getElementById('tabLogin').classList.toggle('active', mode === 'login');
        document.getElementById('tabRegister').classList.toggle('active', mode === 'register');
        slider.style.transform = mode === 'login' ? 'translateX(0)' : 'translateX(calc(100% + 3px))';
    } else {
        segmentNav.style.display = 'none'; // Ẩn thanh gạt khi ở màn OTP/Quên MK
    }

    // Cập nhật phụ đề và mở Form tương ứng
    if (mode === 'login') {
        subtitle.innerText = "Hệ thống quản trị dữ liệu lịch sử";
        forms.login.classList.remove('hidden');
    } else if (mode === 'register') {
        subtitle.innerText = "Yêu cầu cung cấp Mã Bí Mật để khởi tạo";
        forms.register.classList.remove('hidden');
    } else if (mode === 'verify') {
        subtitle.innerText = "Vui lòng nhập mã OTP đã gửi đến email";
        forms.verify.classList.remove('hidden');
    } else if (mode === 'forgot') {
        subtitle.innerText = "Nhập email để nhận mã khôi phục";
        forms.forgot.classList.remove('hidden');
    } else if (mode === 'reset') {
        subtitle.innerText = "Thiết lập mật khẩu quản trị mới";
        forms.reset.classList.remove('hidden');
    }
}

// 1. NHẬN MÃ BÍ MẬT VỀ EMAIL
async function handleRequestSecret() {
    const emailInput = document.getElementById('regEmail').value.trim();
    if (!emailInput) {
        alert("Vui lòng nhập Email của bạn vào ô Email phía trên trước khi nhận mã!");
        return;
    }

    const btnGet = document.getElementById('btnGetSecret');
    const originalText = btnGet.innerText;
    btnGet.innerText = "Đang gửi...";
    btnGet.style.pointerEvents = "none";

    try {
        const response = await fetch(`${API_BASE_URL}/admin/request-secret`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: emailInput })
        });
        const data = await response.json();
        if (response.ok) alert("Thành công! " + data.message);
        else alert("Lỗi: " + data.error);
    } catch (err) {
        alert("Lỗi kết nối máy chủ!");
    } finally {
        btnGet.innerText = originalText;
        btnGet.style.pointerEvents = "auto";
    }
}

// 2. XỬ LÝ ĐĂNG KÝ (GỌI API TẠO TÀI KHOẢN VÀ GỬI OTP)
async function handleRegister(event) {
    event.preventDefault();
    const submitBtn = event.target.querySelector('button');
    const btnSpan = submitBtn.querySelector('span');
    const originalText = btnSpan.innerText;
    
    const payload = {
        full_name: document.getElementById('regName').value.trim(),
        email: document.getElementById('regEmail').value.trim(),
        password: document.getElementById('regPassword').value,
        secret_key: document.getElementById('regSecret').value.trim()
    };

    btnSpan.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Đang khởi tạo...';
    submitBtn.disabled = true;

    try {
        const response = await fetch(`${API_BASE_URL}/admin/register`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const data = await response.json();

        if (response.ok) {
            alert(data.message);
            tempRegEmail = payload.email; // Lưu lại để dùng ở bước OTP
            switchTab('verify');
        } else {
            alert("Lỗi Đăng ký: " + data.error);
        }
    } catch (error) { alert("Lỗi kết nối máy chủ!"); } 
    finally { btnSpan.innerText = originalText; submitBtn.disabled = false; }
}

// 3. XÁC THỰC OTP ĐĂNG KÝ (DÙNG CHUNG API CỦA NGƯỜI CHƠI)
async function handleVerifyReg(event) {
    event.preventDefault();
    const submitBtn = event.target.querySelector('button');
    const btnSpan = submitBtn.querySelector('span');
    const originalText = btnSpan.innerText;

    btnSpan.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Đang xác minh...';
    submitBtn.disabled = true;

    try {
        const response = await fetch(`${API_BASE_URL}/verify-otp`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: tempRegEmail, otp_code: document.getElementById('regOtpInput').value.trim() })
        });
        const data = await response.json();

        if (response.ok) {
            alert("Kích hoạt đặc quyền Admin thành công! Vui lòng đăng nhập.");
            document.getElementById('registerForm').reset();
            document.getElementById('verifyForm').reset();
            switchTab('login');
        } else {
            alert("Lỗi xác minh: " + data.error);
        }
    } catch (error) { alert("Lỗi kết nối máy chủ!"); } 
    finally { btnSpan.innerText = originalText; submitBtn.disabled = false; }
}

// 4. XỬ LÝ ĐĂNG NHẬP
async function handleLogin(event) {
    event.preventDefault();
    const submitBtn = event.target.querySelector('button');
    const btnSpan = submitBtn.querySelector('span');
    const originalText = btnSpan.innerText;

    btnSpan.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Đang kiểm tra...';
    submitBtn.disabled = true;

    try {
        const response = await fetch(`${API_BASE_URL}/admin/login`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: document.getElementById('logEmail').value.trim(), password: document.getElementById('logPassword').value })
        });
        const data = await response.json();

        if (response.ok) {
            localStorage.setItem('admin_session', 'active');
            localStorage.setItem('admin_user', JSON.stringify(data.admin));
            window.location.href = 'admin-dashboard.html';
        } else {
            alert("Đăng nhập thất bại: " + data.error);
        }
    } catch (error) { alert("Lỗi kết nối máy chủ!"); } 
    finally { btnSpan.innerHTML = originalText; submitBtn.disabled = false; }
}

// 5. GỬI MÃ OTP QUÊN MẬT KHẨU
async function handleForgotPass(event) {
    event.preventDefault();
    const submitBtn = event.target.querySelector('button');
    const btnSpan = submitBtn.querySelector('span');
    const originalText = btnSpan.innerText;

    const email = document.getElementById('forgotEmail').value.trim();
    btnSpan.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Đang gửi mã...';
    submitBtn.disabled = true;

    try {
        const response = await fetch(`${API_BASE_URL}/forgot-password`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email })
        });
        const data = await response.json();

        if (response.ok) {
            alert("Mã OTP đã được gửi đến email quản trị của bạn.");
            tempRecoveryEmail = email;
            switchTab('reset');
        } else { alert("Lỗi: " + data.error); }
    } catch (error) { alert("Lỗi kết nối máy chủ!"); } 
    finally { btnSpan.innerText = originalText; submitBtn.disabled = false; }
}

// 6. CẬP NHẬT MẬT KHẨU MỚI
async function handleResetPass(event) {
    event.preventDefault();
    const submitBtn = event.target.querySelector('button');
    const btnSpan = submitBtn.querySelector('span');
    const originalText = btnSpan.innerText;

    btnSpan.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Đang cập nhật...';
    submitBtn.disabled = true;

    try {
        const response = await fetch(`${API_BASE_URL}/reset-password`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: tempRecoveryEmail, otp_code: document.getElementById('resetOtp').value.trim(), new_password: document.getElementById('resetPassword').value })
        });
        const data = await response.json();

        if (response.ok) {
            alert("Cập nhật mật khẩu thành công! Vui lòng đăng nhập lại.");
            document.getElementById('forgotForm').reset();
            document.getElementById('resetForm').reset();
            switchTab('login');
        } else { alert("Lỗi: " + data.error); }
    } catch (error) { alert("Lỗi kết nối máy chủ!"); } 
    finally { btnSpan.innerText = originalText; submitBtn.disabled = false; }
}