# Hướng dẫn cài skin cho webos-vibehack

Bộ này biến launcher [webos-vibehack](https://github.com/OmkarK97/webos-vibehack) (ô chữ nhật to, nền chuyển màu) thành giao diện mới:

- Hình nền phong cảnh tràn màn hình
- Đồng hồ lớn + ngày tháng + **thời tiết** ở góc trái trên
- **Một hàng icon vuông ở đáy**, tên app nằm dưới từng icon, trượt ngang bằng phím trái/phải
- Icon nét cao 1024×1024 thay cho icon 130px mờ mà tivi cấp
- Có sẵn ô **Settings** và ô **Inputs** ngay trong hàng icon

Đã chạy thực tế trên LG QNED 55" webOS 25 (bản gốc tác giả test trên webOS 26).

## 1. Điều kiện

- Tivi LG chạy webOS, đã cài được webos-vibehack bản gốc và chạy ổn (Developer Mode + `install.sh` thành công ít nhất 1 lần). Nếu chưa, làm theo README của repo gốc trước.
- Một máy Mac (hoặc máy có Node.js + Python 3) cùng mạng Wi-Fi với tivi — chính máy bạn đã dùng để cài bản gốc.
- Thư mục webos-vibehack trên máy đó (chứa `install.sh`, `sync-apps.py`, thư mục `app/`).

## 2. Sao lưu trước (quan trọng)

Trong thư mục webos-vibehack, chạy:

```bash
cp app/app.js app/app.js.goc
cp app/style.css app/style.css.goc
cp app/index.html app/index.html.goc
cp sync-apps.py sync-apps.py.goc
```

Đây là đường lui: muốn quay về giao diện cũ chỉ cần chép ngược lại rồi cài lại (mục 6).

## 3. Chép file của bộ skin đè lên

Tải repo này về (nút Code → Download ZIP, hoặc `git clone`), rồi chép:

| File trong repo này | Chép vào |
| --- | --- |
| `app/style.css` | `app/style.css` (đè) |
| `app/index.html` | `app/index.html` (đè) |
| `app/app.js` | `app/app.js` (đè) |
| `app/wallpaper.jpg` | `app/wallpaper.jpg` (mới) |
| `app/config.js` | `app/config.js` (đè — hoặc tự sửa config của bạn theo mục 5) |
| `sync-apps.py` | `sync-apps.py` (đè) |
| thư mục `icons-custom/` | đặt cạnh `sync-apps.py` |

## 4. Cài lên tivi

Tivi đang bật, ở màn hình chính. Trên máy Mac:

```bash
TV_HOST=192.168.1.6 ./install.sh    # thay bằng IP tivi của bạn
```

Lần đầu sau khi đổi `sync-apps.py`, tivi có thể hiện bảng hỏi cho phép kết nối — bấm đồng ý trên tivi. Khi log hiện `Success` và `Launched application com.gathin.tvhome` là xong. Bước `ares install` thường mất 1–2 phút, đừng tưởng treo.

## 5. Tùy biến

- **Đổi hình nền:** thay `app/wallpaper.jpg` bằng ảnh 16:9 bất kỳ (nên ≥1920×1080), cài lại. Ảnh sáng quá thì chữ giờ/thời tiết khó đọc — skin đã có sẵn lớp tối dần ở trên và dưới cho dễ đọc.
- **Đổi thành phố thời tiết:** mở `app/app.js`, tìm `fetchWeather`, sửa `latitude`/`longitude` và tên thành phố trong chuỗi hiển thị. Thời tiết lấy từ Open-Meteo (miễn phí, không cần API key), tự cập nhật mỗi 30 phút.
- **Thứ tự app:** sửa `dockApps` trong `app/config.js` (4 app đầu hàng). Ô Settings được ghim ngay sau dock nhờ `pinFirst`. Ô Inputs luôn nằm cuối hàng. Ngoài ra, trên tivi bạn **giữ OK** trên một ô để kéo thả sắp xếp lại — thứ tự được lưu trên tivi.
- **Ẩn app không thích:** thêm id của app vào `hiddenApps` trong `app/config.js` (bản mẫu đã ẩn sẵn 8 Ball Pool). Xem id bằng `venv/bin/python sync-apps.py <IP tivi> --list`.
- **Đổi icon từng app:** thả file PNG vuông (nên 1024×1024) vào `icons-custom/`, đặt tên đúng tên file icon của app đó (xem trong `app/icons/` sau một lần sync). Từ lần sync sau, icon của bạn luôn thắng icon tivi cấp.

## 6. Quay về giao diện cũ

```bash
cp app/app.js.goc app/app.js
cp app/style.css.goc app/style.css
cp app/index.html.goc app/index.html
cp sync-apps.py.goc sync-apps.py
TV_HOST=192.168.1.6 ./install.sh
```

## 7. Cách nó hoạt động (cho người tò mò)

- Tivi chỉ cấp icon tối đa 130×130 qua API, nên icon gốc bị phóng to ~3 lần trên màn 4K và vỡ. `sync-apps.py` đã vá sẽ chép đè icon từ `icons-custom/` ngay sau mỗi lần tải icon từ tivi.
- App Settings xịn của LG (`com.palm.app.settings`) không nằm trong danh sách app mà tivi trả về, nên `sync-apps.py` tự "tiêm" thêm một ô Settings (và ô Inputs) vào danh sách. Bấm ô Settings mở đúng Cài đặt của tivi; ô Inputs mở danh sách HDMI/Live TV.
- Điều hướng được viết lại cho 1 hàng ngang: trái/phải di chuyển, hàng tự trượt theo ô đang chọn; lên/xuống không dùng nữa.
- Nút **Home** vẫn do `home-watch` của bản gốc đảm nhiệm (chạy trên máy Mac/Pi luôn bật) như cũ — bộ skin không đụng tới phần đó.

## 8. Lỗi thường gặp

- **Cài xong vẫn giao diện cũ:** chắc chắn bạn đã chép đè đúng 3 file `app.js`, `style.css`, `index.html` và chạy lại `install.sh` sau khi chép. Thử tắt hẳn app launcher (mở app khác rồi bấm Home) để tivi nạp bản mới.
- **Không có dòng thời tiết:** tivi chưa có mạng ra internet, hoặc Open-Meteo tạm lỗi — dòng thời tiết sẽ tự hiện ở lần cập nhật sau (30 phút) hoặc khi mở lại launcher.
- **`install.sh` dừng lâu ở bước Installing:** bình thường, chờ tối đa ~3 phút. Nếu quá lâu, kiểm tra tivi còn bật và Developer Mode còn hạn (mở app Developer Mode xem số giờ còn lại, bấm Extend nếu sắp hết).
- **Icon một app vẫn mờ:** app đó chưa có file trong `icons-custom/`, nó đang dùng icon 130px của tivi. Tự thêm theo mục 5.

## 9. Ghi công

Launcher gốc: webos-vibehack (OmkarK97), dựa trên cleanyourtv/tv-vibehack (Gathin). Skin này là lớp giao diện + tiện ích bổ sung, chia sẻ cho cộng đồng dùng LG webOS. Hình nền là fan-art Dragon Ball sưu tầm từ Pinterest; icon app thuộc về các hãng tương ứng — chỉ dùng cho mục đích cá nhân.
