# Logo Chifaa — bản gốc được chọn ngày 2026-11-16

Nguồn hiện tại: `assets/logo-chifaa-original-20261116.jpg`, copy nguyên byte từ `C:/Users/MSI-BRAVO/Downloads/logo-chìa.jpg`. Yêu cầu mới là tách nền và dùng logo gốc; không dùng phần bạc hoặc nền navy từ các lần dựng trước.

Asset dùng cho build: `assets/logo-chifaa-original-transparent-v4.png` (PNG RGBA 1254 × 1254). Tách nền bằng công cụ **image_gen tích hợp**, không dùng CLI/API key. Đã giữ kênh alpha của kết quả, không hậu xử lý ảnh bằng Python. Các vùng trắng quanh logo và vùng âm trong logo được chuyển thành trong suốt. Đây là kết quả xử lý raster từ JPG, không tuyên bố giữ nguyên từng pixel của JPG.

Prompt đã dùng:

> Background removal of this exact original Chifaa logo, with ZERO redesign. Make every white background/white negative-space pixel fully transparent, preserving only the clean orange/gold flame outline, orange takeaway box, and the original orange text 'Chifaa'. IMPORTANT: output must be a clean logo cutout with NO red pixels, NO yellow speckles, NO scattered noise, NO leftover background, NO shadows, NO textures, NO extra shapes. The areas between the flame and box and inside the outlined box and letter holes must be completely empty transparent. Preserve the exact shapes/proportions/lettering from the supplied 450x450 image. Do not invent details. Antialiased clean orange edges. True alpha PNG. Full original logo centered with modest transparent padding.

Nơi dùng: đăng nhập, sidebar, Portal, HTML preview và logo trong template workbook được tạo về sau. Build nhúng cùng PNG vào HTML để không phụ thuộc URL ảnh bên ngoài. CSS giữ tỉ lệ, bỏ crop/góc bo/khung màu trên ảnh logo. File phác thảo nguồn và các asset cũ giữ để đối chiếu, không được chọn trong build mới.

## Lịch sử đã được thay thế

Ảnh gốc `assets/logo-chifaa-goc.jpg` được copy nguyên byte từ file người dùng, không chỉnh sửa. Yêu cầu trực tiếp mới của người dùng cho phép chỉnh logo đẹp hơn, thay cho điều khoản giữ logo nguyên byte trong prompt đính kèm.

Logo dùng trong app: `assets/logo-chifaa-navy-v3.png`, nền navy, ngọn lửa cam, phần bạc và hộp thức ăn, giữ chữ Chifaa. Tạo bằng công cụ image_gen tích hợp, không dùng API key. File transparent-v2 là bản thử chưa chọn vì viền nhiễu; không dùng trong build.

Prompt bản được chọn:

> Faithfully restore and polish this Chifaa business logo. Keep orange outer flame/drop, silver/white inner flame, small orange takeaway food box inside, and exact orange word Chifaa below. Match recognizable original silhouette and friendly rounded typography. Clean sharp smooth vector-style contours, no blur or rough pixels, subtle smooth silver gradient. Place on an absolutely SOLID dark navy background hex #17283d, including all negative spaces, no transparency. No grain, no texture, no glow, no smoky bits, no scattered particles, no shadows. Square app brand tile, generous 10 percent padding, entire logo visible and centered. Single logo, no mockup or board, no additional text.

CSS dùng object-fit:contain, không crop ảnh. Đây là logo raster đã tái dựng bằng AI, không phải vector truy nguyên chính xác mọi đường nét. Cần dev/khách kiểm tra nhận diện trước khi dùng thương mại chính thức.
