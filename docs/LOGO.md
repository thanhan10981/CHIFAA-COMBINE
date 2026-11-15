# Logo Chifaa

Ảnh gốc `assets/logo-chifaa-goc.jpg` được copy nguyên byte từ file người dùng, không chỉnh sửa. Yêu cầu trực tiếp mới của người dùng cho phép chỉnh logo đẹp hơn, thay cho điều khoản giữ logo nguyên byte trong prompt đính kèm.

Logo dùng trong app: `assets/logo-chifaa-navy-v3.png`, nền navy, ngọn lửa cam, phần bạc và hộp thức ăn, giữ chữ Chifaa. Tạo bằng công cụ image_gen tích hợp, không dùng API key. File transparent-v2 là bản thử chưa chọn vì viền nhiễu; không dùng trong build.

Prompt bản được chọn:

> Faithfully restore and polish this Chifaa business logo. Keep orange outer flame/drop, silver/white inner flame, small orange takeaway food box inside, and exact orange word Chifaa below. Match recognizable original silhouette and friendly rounded typography. Clean sharp smooth vector-style contours, no blur or rough pixels, subtle smooth silver gradient. Place on an absolutely SOLID dark navy background hex #17283d, including all negative spaces, no transparency. No grain, no texture, no glow, no smoky bits, no scattered particles, no shadows. Square app brand tile, generous 10 percent padding, entire logo visible and centered. Single logo, no mockup or board, no additional text.

CSS dùng object-fit:contain, không crop ảnh. Đây là logo raster đã tái dựng bằng AI, không phải vector truy nguyên chính xác mọi đường nét. Cần dev/khách kiểm tra nhận diện trước khi dùng thương mại chính thức.
