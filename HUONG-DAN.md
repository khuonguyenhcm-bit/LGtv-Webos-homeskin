# Hướng dẫn cài đặt — LG webOS Home Skin (trọn gói, cài 1 lần)

Repo này **tự chứa đầy đủ**: bạn chỉ cần tải đúng repo này về máy, chạy 1 lệnh là tivi có ngay giao diện mới — **không cần cài repo gốc trước, không cần chép file qua lại**.

Giao diện sau khi cài:

- Hình nền phong cảnh tràn màn hình
- Đồng hồ lớn + ngày tháng + **thời tiết** ở góc trái trên
- **Một hàng icon vuông ở đáy**, tên app nằm dưới từng icon, trượt ngang bằng phím trái/phải
- Icon nét cao 1024×1024 thay cho icon 130px mờ mà tivi cấp
- Có sẵn ô **Settings** và ô **Inputs** ngay trong hàng icon

Đã chạy thực tế trên LG QNED 55" webOS 25.

## 1. Chuẩn bị

**Trên tivi — bật Developer Mode (làm 1 lần):**

1. Mở LG Content Store, cài app **Developer Mode**, mở lên và đăng nhập tài khoản LG (miễn phí).
2. Bật **Dev Mode Status** và **Key Server** trong app. Tivi khởi động lại 1 lần.
3. Ghi lại 2 thứ trong app Developer Mode: **địa chỉ IP của tivi** và **Passphrase** (6 ký tự). Phiên Developer Mode có hạn giờ — mở app bấm **Extend** để gia hạn khi sắp hết.

**Trên máy tính (Mac hoặc máy có Node.js + Python 3), cùng mạng Wi-Fi với tivi:**

- Cần **Node.js** (để chạy công cụ `ares` của LG qua `npx`) và **Python 3**. Chưa có Node thì tải bản LTS ở nodejs.org.
- Kết nối lần đầu (ghép nối máy ↔ tivi), chạy 3 lệnh sau trong Terminal, thay `192.168.1.6` bằng IP tivi của bạn và `<passphrase>` bằng mã ở bước trên:

```bash
npx -y -p @webos-tools/cli ares-setup-device -a lgtv -i "{'host':'192.168.1.6','port':'9922','username':'prisoner'}"
npx -y -p @webos-tools/cli ares-novacom --device lgtv --getkey   # nhập passphrase khi được hỏi
npx -y -p @webos-tools/cli ares-setup-device -m lgtv -i "{'privatekey':'lgtv_webos','passphrase':'<passphrase>'}"
```

## 2. Tải bộ cài về máy

```bash
git clone https://github.com/khuonguyenhcm-bit/LGtv-Webos-homeskin.git
cd LGtv-Webos-homeskin
```

Hoặc bấm **Code → Download ZIP** trên trang GitHub rồi giải nén, mở Terminal tại thư mục đó.

## 3. Cài lên tivi — 1 lệnh

Tivi đang bật, ở màn hình chính. Chạy:

```bash
TV_HOST=192.168.1.6 bash install.sh    # thay bằng IP tivi của bạn
```

- Lần chạy đầu, script tự tạo môi trường Python (`venv`) và cài thư viện cần thiết — bạn không phải làm gì thêm.
- Lần đầu kết nối, **tivi hiện bảng hỏi cho phép kết nối (SSAP) — bấm đồng ý trên tivi**, nếu không bước đồng bộ app sẽ bị timeout.
- Bước `ares install` thường mất 1–2 phút, đừng tưởng treo. Khi log hiện `Success` và `Launched application com.gathin.tvhome` là xong — launcher mới mở ngay trên tivi.

## 4. (Tuỳ chọn) Nút Home luôn về màn hình này

Mặc định nút Home của remote về màn hình gốc của LG. Muốn bấm Home là về launcher mới, cài thêm trình theo dõi chạy trên máy tính (máy phải luôn bật/thức):

```bash
bash home-watch-mac.sh install "$(pwd)" 192.168.1.6
```

Gỡ ra: `bash home-watch-mac.sh uninstall`. Bấm Home 2 lần trong 3 giây sẽ về màn hình gốc của LG như cũ (để mở các app không có trong launcher).

## 5. Tuỳ biến

- **Đổi hình nền:** thay `app/wallpaper.jpg` bằng ảnh 16:9 bất kỳ (nên ≥1920×1080), chạy lại mục 3. Ảnh sáng quá thì chữ khó đọc — skin đã có sẵn lớp tối dần ở mép trên/dưới.
- **Đổi thành phố thời tiết:** mở `app/app.js`, tìm `fetchWeather`, sửa `latitude`/`longitude` và tên thành phố trong chuỗi hiển thị. Thời tiết lấy từ Open-Meteo (miễn phí, không cần API key), tự cập nhật mỗi 30 phút. Mặc định: TP. Hồ Chí Minh.
- **Thứ tự app:** sửa `dockApps` trong `app/config.js` (4 app đầu hàng). Ô Settings được ghim ngay sau dock nhờ `pinFirst`; ô Inputs luôn nằm cuối hàng. Trên tivi, **giữ OK** trên một ô để kéo thả sắp xếp — thứ tự được lưu trên tivi.
- **Ẩn app không thích:** thêm id của app vào `hiddenApps` trong `app/config.js` (bản mẫu đã ẩn sẵn 8 Ball Pool). Xem id: `venv/bin/python sync-apps.py <IP tivi> --list`.
- **Đổi icon từng app:** thả PNG vuông (nên 1024×1024) vào `icons-custom/`, đặt tên đúng tên file icon của app đó (xem trong `app/icons/` sau lần cài đầu). Từ lần cài sau, icon của bạn luôn thắng icon tivi cấp.

## 6. Cập nhật / cài lại

Tải bản mới của repo đè lên thư mục cũ (giữ nguyên 2 thứ: file `.lgtv-key.json` — khóa ghép nối của tivi bạn, và thư mục `venv` nếu muốn khỏi tạo lại), rồi chạy lại lệnh ở mục 3.

## 7. Cách nó hoạt động (cho người tò mò)

- Nền tảng là launcher webos-vibehack (xem ghi công ở mục 9); repo này gói sẵn cả nền tảng lẫn skin, nên cài 1 lần là đủ.
- Tivi chỉ cấp icon tối đa 130×130 qua API nên icon gốc phóng to ~3 lần trên màn 4K sẽ vỡ. `sync-apps.py` đã vá sẽ chép đè icon từ `icons-custom/` ngay sau mỗi lần đồng bộ.
- App Settings xịn của LG (`com.palm.app.settings`) không nằm trong danh sách app tivi trả về, nên `sync-apps.py` tự "tiêm" thêm ô Settings (và ô Inputs). Ô Settings mở đúng Cài đặt của tivi; ô Inputs mở danh sách HDMI/Live TV.
- Điều hướng viết cho 1 hàng ngang: trái/phải di chuyển, hàng tự trượt theo ô đang chọn; lên/xuống không dùng.

## 8. Lỗi thường gặp

- **`Permission denied` khi chạy `./install.sh`:** bản tải ZIP không giữ quyền chạy file — dùng `bash install.sh` như hướng dẫn (hoặc `chmod +x install.sh`).
- **Bước đồng bộ bị `TimeoutError ... opening handshake`:** tivi chưa bật, hoặc bảng hỏi kết nối SSAP chưa được bấm đồng ý trên tivi, hoặc phiên Developer Mode đã hết hạn (mở app Developer Mode kiểm tra + Extend). Xử lý xong chạy lại.
- **Ghép nối ares thất bại / đổi tivi:** xóa file `.lgtv-key.json` trong thư mục và làm lại bước ghép nối ở mục 1.
- **Cài xong vẫn giao diện cũ:** mở một app khác rồi bấm Home để tivi nạp lại launcher; kiểm tra log cài có đủ `Success` + `Launched`.
- **Không có dòng thời tiết:** tivi chưa ra được internet hoặc Open-Meteo tạm lỗi — sẽ tự hiện ở lần cập nhật sau (30 phút) hoặc khi mở lại launcher.
- **Icon một app vẫn mờ:** app đó chưa có file trong `icons-custom/`. Tự thêm theo mục 5.

## 9. Ghi công

Launcher gốc: [webos-vibehack](https://github.com/OmkarK97/webos-vibehack) của OmkarK97, chuyển từ [cleanyourtv / tv-vibehack](https://github.com/Gathin23/cleanyourtv) của Gathin (giấy phép ở file `LICENSE`). Repo này là bản đóng gói trọn bộ + skin + icon + vài tiện ích bổ sung, chia sẻ cho cộng đồng dùng LG webOS. Hình nền là fan-art Dragon Ball (Kame House) sưu tầm từ Pinterest; icon các app thuộc về các hãng tương ứng — chỉ dùng cho mục đích cá nhân.
