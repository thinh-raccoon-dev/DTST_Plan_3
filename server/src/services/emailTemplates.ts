function escapeHtml(input: string): string {
  return input
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

export interface RegisterOtpTemplateParams {
  displayName: string;
  email: string;
  otpCode: string;
  expiresMinutes: number;
  appUrl?: string;
  requestedAt?: Date;
}

export interface RenderedEmail {
  subject: string;
  html: string;
  text: string;
}

/**
 * Generates an executive, trust-first HTML + plaintext OTP verification email
 * styled in Đồng Tháp Smart Travel's Mekong Forest & Lotus identity.
 * Built with table-based layout & inline styles for Gmail, Apple Mail, and Outlook.
 */
export function renderRegisterOtpEmail({
  displayName,
  email,
  otpCode,
  expiresMinutes,
  appUrl = 'https://dongthapgo.com',
  requestedAt = new Date(),
}: RegisterOtpTemplateParams): RenderedEmail {
  const safeName = escapeHtml(displayName.trim() || 'bạn');
  const safeEmail = escapeHtml(email.trim());
  const digits = otpCode.replace(/\D/g, '').slice(0, 6).split('');
  const formattedTime = new Intl.DateTimeFormat('vi-VN', {
    dateStyle: 'short',
    timeStyle: 'short',
    timeZone: 'Asia/Ho_Chi_Minh',
  }).format(requestedAt);
  const cleanAppUrl = appUrl.replace(/\/+$/, '');
  const logoUrl = `${cleanAppUrl}/images/logo-mark.png`;

  const digitCells = digits
    .map(
      (d, idx) => `
      <td align="center" valign="middle" style="padding:0 ${idx === digits.length - 1 ? '0' : '6px'} 0 0;">
        <div style="width:46px;height:56px;line-height:56px;background-color:#ffffff;border:1.5px solid #c5dfb8;border-radius:14px;font-family:'SFMono-Regular',Consolas,'Liberation Mono','Courier New',monospace;font-size:28px;font-weight:800;color:#0f2f25;text-align:center;box-shadow:0 4px 12px rgba(15,47,37,0.06);">
          ${escapeHtml(d)}
        </div>
      </td>`,
    )
    .join('');

  const subject = `[Đồng Tháp Go] Mã xác thực OTP của bạn là ${otpCode}`;

  const html = `<!DOCTYPE html>
<html lang="vi" xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta http-equiv="X-UA-Compatible" content="IE=edge" />
  <meta name="color-scheme" content="light only" />
  <meta name="supported-color-schemes" content="light only" />
  <title>${escapeHtml(subject)}</title>
</head>
<body style="margin:0;padding:0;background-color:#f3f5ef;font-family:'Be Vietnam Pro',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;-webkit-font-smoothing:antialiased;color:#273b31;">
  <!-- Hidden Inbox Preheader -->
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;mso-hide:all;">
    Mã xác thực OTP đăng ký tài khoản Đồng Tháp Smart Travel của bạn là ${escapeHtml(otpCode)} — có hiệu lực trong ${expiresMinutes} phút.&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;
  </div>

  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f3f5ef;padding:28px 12px 40px;">
    <tr>
      <td align="center">
        <!-- Main Card Container -->
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:580px;background-color:#ffffff;border-radius:24px;overflow:hidden;border:1px solid #dfe6d7;box-shadow:0 18px 48px -20px rgba(15,47,37,0.22);">

          <!-- Top Lotus-Gold Accent Ribbon -->
          <tr>
            <td style="height:4px;background:linear-gradient(90deg,#176b50 0%,#c4a15a 50%,#efa4b5 100%);font-size:0;line-height:0;">&nbsp;</td>
          </tr>

          <!-- Hero Brand Header -->
          <tr>
            <td style="background-color:#0b2b22;background-image:linear-gradient(135deg,#082019 0%,#103d2f 55%,#176249 100%);padding:30px 32px 28px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td valign="middle" width="54" style="padding-right:14px;">
                    <div style="width:48px;height:48px;border-radius:14px;background-color:rgba(255,255,255,0.12);border:1px solid rgba(255,255,255,0.22);text-align:center;line-height:48px;overflow:hidden;">
                      <img src="${escapeHtml(logoUrl)}" width="36" height="36" alt="Đồng Tháp Smart Travel" style="display:inline-block;vertical-align:middle;border:0;outline:none;" />
                    </div>
                  </td>
                  <td valign="middle">
                    <div style="font-size:11px;font-weight:700;letter-spacing:2.2px;text-transform:uppercase;color:#f3d299;margin-bottom:4px;">
                      &#10022; ĐẤT SEN HỒNG &middot; BẢO MẬT TÀI KHOẢN
                    </div>
                    <div style="font-size:19px;font-weight:800;color:#ffffff;letter-spacing:-0.2px;line-height:1.25;">
                      Đồng Tháp Smart Travel
                    </div>
                  </td>
                </tr>
              </table>

              <div style="margin-top:22px;padding-top:18px;border-top:1px solid rgba(255,255,255,0.14);">
                <h1 style="margin:0;font-size:23px;font-weight:800;line-height:1.3;color:#ffffff;letter-spacing:-0.3px;">
                  Xác thực email đăng ký tài khoản
                </h1>
                <p style="margin:6px 0 0;font-size:13.5px;line-height:1.55;color:#cfe4d6;">
                  Một bước nhỏ nữa để mở Hộ chiếu Trải nghiệm Số &amp; Bản đồ Ký ức Đồng Tháp của riêng bạn.
                </p>
              </div>
            </td>
          </tr>

          <!-- Main Body -->
          <tr>
            <td style="padding:30px 32px 28px;">
              <p style="margin:0 0 12px;font-size:15px;line-height:1.65;color:#153f32;font-weight:600;">
                Xin chào ${safeName},
              </p>
              <p style="margin:0 0 22px;font-size:14.5px;line-height:1.65;color:#4a5d52;">
                Chúng tôi vừa nhận được yêu cầu tạo tài khoản mới trên <strong>Đồng Tháp Smart Travel</strong> cho địa chỉ email <strong style="color:#153f32;">${safeEmail}</strong>. Vui lòng nhập mã xác thực 6 chữ số dưới đây vào màn hình đăng ký:
              </p>

              <!-- Hero OTP Box -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#faf8f0;border:1.5px solid #dcebd4;border-radius:18px;">
                <tr>
                  <td align="center" style="padding:22px 16px 20px;">
                    <div style="font-size:11px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:#5b6b60;margin-bottom:14px;">
                      MÃ XÁC THỰC MỘT LẦN (OTP)
                    </div>

                    <!-- 6 Individual Monospace Digit Tiles -->
                    <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 auto;">
                      <tr>
                        ${digitCells}
                      </tr>
                    </table>

                    <!-- Easy Copy Fallback + Expiry Pill -->
                    <div style="margin-top:16px;">
                      <span style="display:inline-block;padding:6px 14px;border-radius:999px;background-color:#edf5e8;border:1px solid #cce0c2;font-size:12px;font-weight:600;color:#176b50;">
                        &#9201; Mã có hiệu lực trong ${expiresMinutes} phút &middot; Chỉ sử dụng 1 lần
                      </span>
                    </div>
                  </td>
                </tr>
              </table>

              <!-- Verification Metadata Table -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:20px;border:1px solid #e7ece0;border-radius:14px;background-color:#fbfcfa;">
                <tr>
                  <td style="padding:12px 16px;font-size:12.5px;color:#62756a;border-bottom:1px solid #edf1e8;">
                    Email xác thực
                  </td>
                  <td align="right" style="padding:12px 16px;font-size:12.5px;font-weight:700;color:#153f32;border-bottom:1px solid #edf1e8;">
                    ${safeEmail}
                  </td>
                </tr>
                <tr>
                  <td style="padding:12px 16px;font-size:12.5px;color:#62756a;">
                    Thời gian yêu cầu (GMT+7)
                  </td>
                  <td align="right" style="padding:12px 16px;font-size:12.5px;font-weight:600;color:#34483d;">
                    ${escapeHtml(formattedTime)}
                  </td>
                </tr>
              </table>

              <!-- Security Warning Callout -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:20px;background-color:#fef9ed;border:1px solid #f0dfb4;border-left:4px solid #c4a15a;border-radius:12px;">
                <tr>
                  <td style="padding:14px 16px;font-size:12.5px;line-height:1.6;color:#6a521d;">
                    <strong style="color:#523d11;">Lưu ý bảo mật:</strong> Tuyệt đối không chia sẻ mã OTP này với bất kỳ ai. Đội ngũ <strong>Đồng Tháp Smart Travel</strong> không bao giờ gọi điện hay nhắn tin yêu cầu bạn cung cấp mã xác thực. Nếu bạn không thực hiện thao tác đăng ký này, hãy bỏ qua email này.
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Authoritative Brand Footer -->
          <tr>
            <td style="background-color:#f7f9f4;border-top:1px solid #e4ebdc;padding:22px 32px 24px;text-align:center;">
              <p style="margin:0 0 6px;font-size:13px;font-weight:700;color:#153f32;">
                Đồng Tháp Smart Travel &middot; Đất Sen Hồng
              </p>
              <p style="margin:0 0 10px;font-size:12px;line-height:1.6;color:#66786d;">
                Nền tảng Du lịch Thông minh &amp; Hộ chiếu Trải nghiệm Số
              </p>
              <p style="margin:0;font-size:12px;color:#5b6b60;">
                <a href="${escapeHtml(cleanAppUrl)}" style="color:#176b50;font-weight:600;text-decoration:none;">dongthapgo.com</a>
                &nbsp;&middot;&nbsp;
                <a href="mailto:support@dongthapgo.com" style="color:#176b50;font-weight:600;text-decoration:none;">support@dongthapgo.com</a>
                &nbsp;&middot;&nbsp;
                <a href="tel:0942067646" style="color:#176b50;font-weight:600;text-decoration:none;">0942 067 646</a>
              </p>
              <p style="margin:12px 0 0;font-size:11px;color:#8a998f;">
                &copy; ${new Date().getFullYear()} Đồng Tháp Smart Travel. Email được gửi tự động từ hệ thống xác thực.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  const text = [
    'ĐỒNG THÁP SMART TRAVEL — XÁC THỰC EMAIL ĐĂNG KÝ',
    '================================================',
    '',
    `Xin chào ${displayName.trim() || 'bạn'},`,
    '',
    `Mã xác thực OTP đăng ký tài khoản cho email ${email.trim()} của bạn là:`,
    '',
    `    ${otpCode}`,
    '',
    `• Hiệu lực: ${expiresMinutes} phút (chỉ sử dụng 1 lần).`,
    `• Thời gian yêu cầu (GMT+7): ${formattedTime}.`,
    '',
    'LƯU Ý BẢO MẬT: Tuyệt đối không chia sẻ mã OTP này với bất kỳ ai. Nếu bạn không thực hiện yêu cầu này, vui lòng bỏ qua email.',
    '',
    'Đồng Tháp Smart Travel · https://dongthapgo.com · support@dongthapgo.com · Hotline: 0942 067 646',
  ].join('\n');

  return { subject, html, text };
}
