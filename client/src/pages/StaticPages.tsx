import { Compass, ShieldCheck } from 'lucide-react';
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { PageContainer } from '../components/layout/PublicLayout';
import { Badge } from '../components/ui/Badge';
import { ButtonLink } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { EmptyState } from '../components/ui/States';
import { useDocumentTitle } from '../hooks/useDocumentTitle';

function Prose({
  title,
  badge,
  updated,
  children,
}: {
  title: string;
  badge?: string;
  updated: string;
  children: ReactNode;
}) {
  useDocumentTitle(title);
  return (
    <PageContainer width="medium">
      <Card className="p-6 sm:p-10 shadow-raised border-sand-200">
        <div className="flex flex-wrap items-center gap-2 mb-2">
          {badge && (
            <Badge tone="leaf" className="text-xs px-2.5 py-1">
              <ShieldCheck className="size-3.5" /> {badge}
            </Badge>
          )}
          <span className="text-xs text-river-500">Hiệu lực: {updated}</span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-river-950 tracking-tight">{title}</h1>
        <div className="mt-6 space-y-5 text-sm sm:text-base leading-relaxed text-river-800 [&_h2]:mt-8 [&_h2]:text-lg [&_h2]:font-bold [&_h2]:text-river-900 [&_h2]:border-b [&_h2]:border-sand-200 [&_h2]:pb-2 [&_h3]:mt-6 [&_h3]:text-base [&_h3]:font-semibold [&_h3]:text-leaf-800 [&_li]:ml-5 [&_li]:list-disc [&_ul]:space-y-2 [&_p]:leading-relaxed [&_strong]:text-river-950">
          {children}
        </div>
      </Card>
    </PageContainer>
  );
}

export function PrivacyPage() {
  return (
    <Prose
      title="Chính sách Quyền riêng tư & Bảo vệ Dữ liệu Cá nhân"
      badge="Tuân thủ Nghị định 13/2023/NĐ-CP"
      updated="Tháng 11/2026 (Phiên bản Thương mại 2.2)"
    >
      <p className="font-medium text-river-900">
        Nền tảng <strong>Đồng Tháp Smart Travel (DTST)</strong> cam kết tôn trọng và bảo vệ tuyệt đối quyền riêng tư cùng dữ liệu cá nhân của người dùng, du khách và đối tác du lịch. Chính sách này được thiết lập phù hợp với <strong>Nghị định số 13/2023/NĐ-CP</strong> của Chính phủ về Bảo vệ Dữ liệu Cá nhân, <strong>Luật An toàn thông tin mạng 2015</strong> và <strong>Luật An ninh mạng 2018</strong>.
      </p>

      <h2>1. Định danh Đơn vị Kiểm soát và Xử lý Dữ liệu</h2>
      <p>
        Trong khuôn khổ chính sách này, <strong>Đồng Tháp Smart Travel</strong> (sau đây gọi tắt là “Chúng tôi”, “Ban Quản trị Nền tảng”) đóng vai trò là Bên Kiểm soát và Bên Xử lý dữ liệu cá nhân đối với mọi thông tin thu thập thông qua cổng web ứng dụng, thiết bị số tại điểm đến và các dịch vụ liên kết.
      </p>
      <ul>
        <li><strong>Tên nền tảng:</strong> Đồng Tháp Smart Travel (Nền tảng Du lịch Thông minh & Hộ chiếu Trải nghiệm số)</li>
        <li><strong>Đơn vị quản lý & phát triển:</strong> Đội ngũ Kỹ thuật & Bản quyền Công nghệ DTST Solution</li>
        <li><strong>Email tiếp nhận hỗ trợ bảo vệ dữ liệu:</strong> <a href="mailto:support@dongthapgo.com" className="font-semibold text-leaf-700 underline">support@dongthapgo.com</a></li>
        <li><strong>Đường dây nóng (Hotline):</strong> 0942 067 646</li>
      </ul>

      <h2>2. Danh mục Dữ liệu Cá nhân Được Thu thập</h2>
      <p>Chúng tôi chỉ thu thập các dữ liệu thực sự cần thiết nhằm cung cấp dịch vụ trải nghiệm du lịch số tối ưu:</p>
      
      <h3>a. Dữ liệu tài khoản thành viên (Dữ liệu cơ bản)</h3>
      <ul>
        <li><strong>Thông tin nhận diện:</strong> Địa chỉ email, tên hiển thị (Display Name), vai trò người dùng (Du khách, Đối tác điểm đến, Quản trị viên).</li>
        <li><strong>Thông tin bảo mật:</strong> Mật khẩu tài khoản được mã hóa một chiều tuyệt đối thông qua giải thuật <strong>bcrypt</strong> với chi phí an toàn cao (Salt Rounds = 12). Hệ thống không bao giờ lưu trữ mật khẩu gốc dưới dạng văn bản thuần (plain text).</li>
        <li><strong>Sở thích du lịch:</strong> Loại hình trải nghiệm quan tâm (thiên nhiên, sinh thái, văn hóa, ẩm thực, lịch sử), số ngày dự kiến tham quan và thời lượng di chuyển mỗi ngày.</li>
      </ul>

      <h3>b. Dữ liệu trải nghiệm & Gamification</h3>
      <ul>
        <li><strong>Lịch trình du lịch:</strong> Các chuyến đi do du khách tự tạo hoặc do Trí tuệ Nhân tạo (AI V9 Engine) thiết kế.</li>
        <li><strong>Hộ chiếu số & Dấu mộc Check-in:</strong> Lịch sử quét mã QR tại các di tích, thời điểm check-in, số câu trả lời trắc nghiệm thử thách văn hóa và huy hiệu thành tích được trao thưởng.</li>
        <li><strong>Địa điểm yêu thích:</strong> Danh sách các điểm đến được lưu lại phục vụ việc tra cứu nhanh.</li>
      </ul>

      <h3>c. Dữ liệu Vị trí Địa lý (GPS - Dữ liệu nhạy cảm)</h3>
      <ul>
        <li>Vị trí GPS của thiết bị chỉ được kích hoạt khi du khách <strong>chủ động cho phép trên trình duyệt</strong> nhằm:
          <ol className="list-decimal ml-5 mt-1 space-y-1">
            <li>Điều hướng, chỉ đường trực tiếp tới các điểm tham quan qua tích hợp Google Maps.</li>
            <li>Xác thực phạm vi thực địa khi quét mã QR check-in tại các điểm di tích danh lam thắng cảnh.</li>
          </ol>
        </li>
        <li><strong>Cam kết:</strong> Hệ thống <em>tuyệt đối không theo dõi ngầm</em> vị trí của người dùng khi trang web đóng lại hoặc khi người dùng từ chối cấp quyền định vị.</li>
      </ul>

      <h3>d. Dữ liệu Kỹ thuật, Phiên làm việc & Cookie</h3>
      <ul>
        <li><strong>Cookie phiên an toàn (HttpOnly Cookie):</strong> Dùng để xác thực đăng nhập bảo mật (`dtst_access`), tự động hết hạn và ngăn chặn truy cập trái phép qua script độc hại (XSS).</li>
        <li><strong>Cookie bảo vệ CSRF (`dtst_csrf`):</strong> Cơ chế mã hóa Double-submit token ngăn chặn hành vi gửi yêu cầu mạo danh xuyên trang.</li>
        <li><strong>Mã phiên làm việc ẩn danh (Anonymous Session ID):</strong> Hỗ trợ du khách chưa đăng nhập vẫn có thể trải nghiệm tính năng tích điểm hộ chiếu tạm thời trên thiết bị cá nhân.</li>
      </ul>

      <h2>3. Mục đích và Cơ sở Pháp lý Xử lý Dữ liệu</h2>
      <p>Dữ liệu cá nhân được xử lý dựa trên sự đồng thuận của người dùng và các quy định pháp luật hiện hành nhằm:</p>
      <ul>
        <li>Cung cấp và duy trì các tính năng: Lập lịch trình tự động bằng AI, bản đồ số, quét mã QR và bảng xếp hạng thành tựu.</li>
        <li>Cá nhân hóa nội dung khuyến nghị dựa trên sở thích văn hóa và khoảng thời gian thực tế của du khách.</li>
        <li>Thống kê lưu lượng du khách ẩn danh giúp cơ quan xúc tiến du lịch Đồng Tháp và các đối tác dịch vụ nâng cao chất lượng đón tiếp.</li>
        <li>Ngăn chặn các hành vi tấn công mạng, phá hoại mã QR hoặc gian lận hệ thống điểm thưởng.</li>
      </ul>

      <h2>4. Cam kết Không Bán và Không Chia sẻ Dữ liệu cho Bên Thứ Ba</h2>
      <p>
        Chúng tôi <strong>cam kết tuyệt đối không bán, cho thuê, trao đổi hay chuyển giao dữ liệu cá nhân</strong> của du khách cho bất kỳ bên thứ ba nào vì mục đích quảng cáo thương mại hoặc tiếp thị không mong muốn. Dữ liệu chỉ được chia sẻ trong các trường hợp giới hạn sau:
      </p>
      <ul>
        <li><strong>Dịch vụ bản đồ Google Maps & Valhalla Routing:</strong> Tọa độ điểm đến được chuyển tiếp qua giao thức bảo mật API để hiển thị bản đồ và tính toán thời gian di chuyển.</li>
        <li><strong>Cơ quan chức năng có thẩm quyền:</strong> Khi có yêu cầu bằng văn bản từ cơ quan thực thi pháp luật của Nước Cộng hòa Xã hội Chủ nghĩa Việt Nam theo đúng trình tự pháp luật quy định.</li>
      </ul>

      <h2>5. Quyền của Chủ thể Dữ liệu (Quyền của Du khách)</h2>
      <p>Theo Điều 9 Nghị định 13/2023/NĐ-CP, du khách khi tham gia nền tảng có các quyền sau:</p>
      <ul>
        <li><strong>Quyền được biết & Quyền đồng ý:</strong> Được thông báo rõ ràng về chính sách xử lý dữ liệu trước khi đăng ký hoặc cấp quyền vị trí.</li>
        <li><strong>Quyền truy cập & Chỉnh sửa:</strong> Tự do tra cứu, chỉnh sửa thông tin cá nhân và sở thích du lịch tại trang <Link to="/account" className="font-semibold text-leaf-700 underline">Hồ sơ cá nhân</Link>.</li>
        <li><strong>Quyền xóa dữ liệu (Quyền được lãng quên):</strong> Có quyền yêu cầu Ban Quản trị xóa toàn bộ tài khoản, lịch sử check-in và dữ liệu liên quan khỏi hệ thống vĩnh viễn.</li>
        <li><strong>Quyền khiếu nại:</strong> Gửi khiếu nại trực tiếp đến Ban Quản trị nếu phát hiện bất kỳ dấu hiệu xâm phạm an toàn dữ liệu cá nhân.</li>
      </ul>

      <h2>6. Tiêu chuẩn An toàn Thông tin & Lưu trữ</h2>
      <ul>
        <li>Toàn bộ thông tin truyền tải giữa trình duyệt người dùng và máy chủ được mã hóa qua giao thức an toàn SSL/TLS (HTTPS).</li>
        <li>Cơ sở dữ liệu được triển khai theo tiêu chuẩn an toàn thông tin, sao lưu định kỳ và kiểm soát truy cập nghiêm ngặt theo mô hình Phân quyền Dựa trên Vai trò (RBAC).</li>
        <li>Trường hợp xảy ra sự cố an toàn dữ liệu, Ban Quản trị cam kết khắc phục kịp thời và thực hiện nghĩa vụ thông báo tới Bộ Công an (A05) và người dùng bị ảnh hưởng trong thời hạn 72 giờ theo luật định.</li>
      </ul>
    </Prose>
  );
}

export function TermsPage() {
  return (
    <Prose
      title="Điều khoản Sử dụng Dịch vụ & Quy chế Hoạt động"
      badge="Phiên bản Thương mại 2.2"
      updated="Tháng 11/2026 (Sẵn sàng Vận hành Thực tế)"
    >
      <p className="font-medium text-river-900">
        Chào mừng bạn đến với <strong>Đồng Tháp Smart Travel (DTST)</strong> — Nền tảng Du lịch Thông minh và Hộ chiếu Trải nghiệm số. Khi truy cập, đăng ký tài khoản hoặc sử dụng bất kỳ tính năng nào của nền tảng, bạn xác nhận đã đọc, hiểu rõ và đồng ý bị ràng buộc bởi các Điều khoản Sử dụng này cùng các quy định pháp luật liên quan của Nước Cộng hòa Xã hội Chủ nghĩa Việt Nam.
      </p>

      <h2>1. Phạm vi Dịch vụ và Tư cách Pháp lý</h2>
      <p>
        Đồng Tháp Smart Travel là giải pháp công nghệ số hóa du lịch toàn diện, kết nối du khách, điểm đến tham quan, cơ sở lưu trú và cơ quan quản lý văn hóa du lịch. Nền tảng cung cấp:
      </p>
      <ul>
        <li>Hệ thống cơ sở dữ liệu số hóa 56 điểm đến di tích lịch sử, làng nghề truyền thống và danh lam sinh thái Đồng Tháp & lân cận.</li>
        <li>Công cụ Lập lịch trình Thông minh AI V9 ứng dụng thuật toán tối ưu hóa tuyến đường đa điểm kết hợp công nghệ định tuyến Valhalla.</li>
        <li>Hệ thống Hộ chiếu Trải nghiệm số, quét mã QR check-in thực địa và Gamification văn hóa bản địa.</li>
        <li>Cổng Quản trị Doanh nghiệp / Đối tác (`/admin`) phục vụ công tác giám sát, điều phối và phân tích lưu lượng khách.</li>
      </ul>

      <h2>2. Quyền Sở hữu Trí tuệ và Bản quyền Phần mềm</h2>
      <ul>
        <li>
          <strong>Bản quyền nền tảng:</strong> Toàn bộ mã nguồn, cấu trúc thuật toán AI Trip Planner V9, kiến trúc hệ thống, thiết kế đồ họa (UI/UX), nhãn hiệu, biểu trưng thương hiệu (Logo) và nội dung số hóa thuộc quyền sở hữu trí tuệ độc quyền của Đơn vị Phát triển Nền tảng.
        </li>
        <li>
          <strong>Quy chế thương mại & Chuyển giao công nghệ:</strong> Nền tảng được xây dựng sẵn sàng cho mục đích khai thác thực tế, cấp phép sử dụng phần mềm dịch vụ (SaaS) hoặc chuyển giao trọn gói cho cơ quan nhà nước (B2G), doanh nghiệp lữ hành và nhà phát triển du lịch địa phương (B2B). Mọi hình thức chuyển giao, nhượng quyền đều phải được xác lập bằng hợp đồng kinh tế hợp pháp.
        </li>
        <li>
          <strong>Hành vi nghiêm cấm:</strong> Nghiêm cấm mọi hành vi sao chép, trích xuất dữ liệu tự động (data scraping), dịch ngược mã nguồn (reverse engineering), can thiệp bẻ khóa thuật toán hoặc phân phối lại dịch vụ vì mục đích thương mại trái phép khi chưa có văn bản chấp thuận.
        </li>
      </ul>

      <h2>3. Tiêu chuẩn Hành vi và Trách nhiệm của Người dùng</h2>
      <p>Khi sử dụng nền tảng, người dùng cam kết:</p>
      <ul>
        <li>Cung cấp thông tin chính xác, trung thực khi đăng ký tài khoản thành viên.</li>
        <li>Tự chịu trách nhiệm bảo mật thông tin đăng nhập cá nhân; thông báo ngay cho Ban Quản trị khi phát hiện tài khoản bị truy cập trái phép.</li>
        <li>
          <strong>Tuân thủ văn hóa ứng xử tại điểm đến:</strong> Không sử dụng nền tảng để tuyên truyền nội dung xuyên tạc lịch sử, xâm phạm thuần phong mỹ tục, hay vi phạm quy định tại các di tích lịch sử - văn hóa được bảo vệ.
        </li>
        <li>
          <strong>Không gian lận công nghệ:</strong> Nghiêm cấm sử dụng công cụ giả lập GPS (fake GPS), can thiệp mã QR tại điểm đến, hoặc gian lận đáp án thử thách nhằm trục lợi điểm thưởng bất chính.
        </li>
      </ul>

      <h2>4. Quy định dành cho Điểm đến & Đối tác Dịch vụ (Partners)</h2>
      <ul>
        <li>
          Tài khoản Đối tác được cấp quyền truy cập phân hệ quản lý thông tin điểm du lịch (`/admin/destinations`) có trách nhiệm bảo đảm tính chính xác, kịp thời về biểu phí tham quan, giờ mở cửa và thông tin dịch vụ của đơn vị mình.
        </li>
        <li>
          Đối tác không được tự ý xóa, thay đổi các thông tin di tích lịch sử được chuẩn hóa bởi cơ quan quản lý văn hóa địa phương mà chưa có sự đồng thuận.
        </li>
      </ul>

      <h2>5. Công cụ Trí tuệ Nhân tạo và Dịch vụ Định tuyến</h2>
      <ul>
        <li>
          Thuật toán Lập lịch trình AI V9 tự động tính toán thời gian tham quan, phân bổ thời gian ăn uống và tối ưu hóa tuyến đường di chuyển dựa trên khoảng cách địa lý thực tế.
        </li>
        <li>
          <strong>Khuyến nghị an toàn:</strong> Lịch trình mang tính chất tư vấn khoa học. Du khách cần chủ động cân nhắc tình hình giao thông thực tế, điều kiện thời tiết mùa nước nổi hoặc sự kiện lễ hội địa phương để có chuyến đi an toàn và trọn vẹn nhất.
        </li>
      </ul>

      <h2>6. Giới hạn Trách nhiệm và Sự kiện Bất khả kháng</h2>
      <ul>
        <li>
          Ban Quản trị nền tảng nỗ lực tối đa để đảm bảo hệ thống vận hành liên tục 24/7 với độ sẵn sàng cao. Tuy nhiên, chúng tôi được miễn trừ trách nhiệm trong các tình huống bất khả kháng ngoài tầm kiểm soát kỹ thuật như: thiên tai, dịch bệnh, sự cố gián đoạn cáp quang Internet quốc tế, hoặc các chỉ thị khẩn cấp từ cơ quan quản lý nhà nước đóng cửa tạm thời điểm di tích.
        </li>
        <li>
          Chúng tôi có quyền tạm ngừng dịch vụ trong thời gian ngắn để tiến hành bảo trì định kỳ hoặc nâng cấp hạ tầng hệ thống và sẽ thông báo trước qua công cụ Phát thanh Thông báo Hệ thống.
        </li>
      </ul>

      <h2>7. Luật Áp dụng và Giải quyết Tranh chấp</h2>
      <p>
        Các Điều khoản này được điều chỉnh và giải thích theo Pháp luật Nước Cộng hòa Xã hội Chủ nghĩa Việt Nam. Mọi tranh chấp, khiếu nại phát sinh từ việc sử dụng dịch vụ sẽ được các bên ưu tiên giải quyết thông qua thương lượng hòa giải thiện chí. Trường hợp không đạt được thỏa thuận, tranh chấp sẽ được đưa ra Tòa án nhân dân có thẩm quyền tại Việt Nam để giải quyết theo luật định.
      </p>

      <h2>8. Đầu mối Hỗ trợ & Tiếp nhận Ý kiến</h2>
      <p>
        Mọi thắc mắc, đề xuất hợp tác thương mại, chuyển giao giải pháp số hóa du lịch hoặc phản hồi về điều khoản sử dụng, xin vui lòng liên hệ:
      </p>
      <ul>
        <li><strong>Đơn vị điều hành:</strong> Ban Quản trị Nền tảng Đồng Tháp Smart Travel</li>
        <li><strong>Đường dây nóng:</strong> 0942 067 646 (Hỗ trợ 24/7)</li>
        <li><strong>Email:</strong> <a href="mailto:support@dongthapgo.com" className="font-semibold text-leaf-700 underline">support@dongthapgo.com</a></li>
        <li><strong>Kênh thông tin chính thức:</strong> <a href="https://www.facebook.com/share/1CCKSRvhPa/?mibextid=wwXIfr" target="_blank" rel="noopener noreferrer" className="font-semibold text-leaf-700 underline">Fanpage Đồng Tháp Smart Travel</a></li>
      </ul>
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
