import { Compass } from 'lucide-react';
import type { ReactNode } from 'react';
import { PageContainer } from '../components/layout/PublicLayout';
import { ButtonLink } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { EmptyState } from '../components/ui/States';
import { useDocumentTitle } from '../hooks/useDocumentTitle';

function Prose({ title, updated, children }: { title: string; updated: string; children: ReactNode }) {
  useDocumentTitle(title);
  return (
    <PageContainer width="medium">
      <Card className="p-6 sm:p-10">
        <h1 className="text-3xl">{title}</h1>
        <p className="mt-1 text-sm text-river-500">Cập nhật: {updated}</p>
        <div className="mt-6 space-y-5 text-river-800 [&_h2]:mt-8 [&_h2]:text-lg [&_li]:ml-5 [&_li]:list-disc [&_ul]:space-y-1.5">{children}</div>
      </Card>
    </PageContainer>
  );
}

export function PrivacyPage() {
  return (
    <Prose title="Chính sách quyền riêng tư" updated="10/2026 (bản MVP)">
      <p>
        Trang này mô tả dữ liệu mà bản thử nghiệm (MVP) của Nền tảng Du lịch Thông minh và Hộ chiếu Trải nghiệm số Đồng Tháp thu thập
        và cách sử dụng. Chúng tôi chỉ thu thập dữ liệu cần thiết để vận hành các chức năng.
      </p>
      <h2>Dữ liệu tài khoản</h2>
      <ul>
        <li>Email, tên hiển thị và mật khẩu (chỉ lưu dạng băm bcrypt, không lưu mật khẩu gốc).</li>
        <li>Lịch trình đã lưu, địa điểm yêu thích, check-in, kết quả thử thách và huy hiệu.</li>
      </ul>
      <h2>Cookie</h2>
      <ul>
        <li><strong>Cookie phiên đăng nhập</strong> (HttpOnly) để duy trì đăng nhập trong tối đa 7 ngày.</li>
        <li><strong>Cookie bảo vệ CSRF</strong> để ngăn yêu cầu giả mạo.</li>
        <li>
          <strong>Mã phiên ẩn danh</strong>: một mã ngẫu nhiên gắn với trình duyệt, dùng để lưu hộ chiếu khi bạn chưa đăng nhập và ước
          lượng số lượt truy cập không trùng lặp. Mã này không chứa thông tin cá nhân.
        </li>
      </ul>
      <h2>Dữ liệu thống kê</h2>
      <p>
        Hệ thống ghi nhận các sự kiện như mở trang địa điểm, mở trang từ mã QR, gửi đáp án, check-in và tạo lịch trình, kèm thời gian và mã
        phiên. Chúng tôi <strong>không</strong> lưu địa chỉ IP hay thông tin thiết bị vào dữ liệu thống kê, và không theo dõi vị trí GPS.
        Số liệu chỉ dùng để cải thiện nội dung và không được bán hay chia sẻ cho bên thứ ba.
      </p>
      <h2>Dữ liệu trên thiết bị</h2>
      <p>Bản nháp lịch trình chưa lưu được giữ trong bộ nhớ trình duyệt (localStorage) và sẽ mất nếu bạn xóa dữ liệu trình duyệt.</p>
      <h2>Bản đồ và liên kết ngoài</h2>
      <p>Bản đồ nhúng do OpenStreetMap cung cấp; nút chỉ đường mở Google Maps. Khi dùng các dịch vụ này, chính sách của họ được áp dụng.</p>
      <h2>Quyền của bạn</h2>
      <p>Bạn có thể yêu cầu xem hoặc xóa dữ liệu tài khoản bằng cách liên hệ nhóm dự án. Bản MVP chưa có chức năng tự xóa tài khoản.</p>
      <p className="text-sm text-river-500">Hệ thống áp dụng các biện pháp bảo mật hợp lý nhưng không thể đảm bảo an toàn tuyệt đối.</p>
    </Prose>
  );
}

export function TermsPage() {
  return (
    <Prose title="Điều khoản sử dụng" updated="10/2026 (bản MVP)">
      <p>Đây là bản thử nghiệm phục vụ nghiên cứu và trình diễn. Khi sử dụng, bạn đồng ý với các điều khoản cơ bản sau.</p>
      <h2>Độ chính xác của thông tin</h2>
      <ul>
        <li>Một số nội dung là dữ liệu minh họa và được gắn nhãn rõ ràng. Thông tin chưa được xác minh có thể chưa chính xác.</li>
        <li>Hãy kiểm tra giờ mở cửa, giá vé và điều kiện tham quan với đơn vị quản lý điểm đến trước chuyến đi.</li>
        <li>Thời lượng lịch trình là ước tính và chưa tính thời gian di chuyển thực tế.</li>
      </ul>
      <h2>Điểm thưởng và huy hiệu</h2>
      <ul>
        <li>Điểm thưởng và huy hiệu chỉ mang tính trải nghiệm, không có giá trị quy đổi.</li>
        <li>Check-in là tự xác nhận; hệ thống không xác minh vị trí thực tế.</li>
        <li>Hành vi gian lận hoặc làm quá tải hệ thống có thể bị giới hạn truy cập.</li>
      </ul>
      <h2>Tài khoản</h2>
      <p>Bạn chịu trách nhiệm bảo mật mật khẩu của mình. Tài khoản quản trị chỉ được cấp bởi nhóm dự án.</p>
    </Prose>
  );
}

export function NotFoundPage() {
  useDocumentTitle('Không tìm thấy trang');
  return (
    <PageContainer>
      <EmptyState
        className="mx-auto my-10 max-w-xl"
        icon={<Compass className="size-6" aria-hidden />}
        title="404 · Không tìm thấy trang"
        description="Đường dẫn không tồn tại hoặc đã được thay đổi."
        action={<ButtonLink to="/">Về trang chủ</ButtonLink>}
      />
    </PageContainer>
  );
}
