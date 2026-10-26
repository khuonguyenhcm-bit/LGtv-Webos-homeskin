#!/usr/bin/env bash
# LG webOS Home Skin — cai dat mot lenh duy nhat (khong can cai repo goc truoc).
#
# Cach dung (tren Mac, cung Wi-Fi voi tivi, tivi da bat Developer Mode):
#   curl -fsSL https://raw.githubusercontent.com/khuonguyenhcm-bit/LGtv-Webos-homeskin/main/setup.sh | bash
# Hoac, neu da co file nay trong thu muc repo:
#   TV_HOST=192.168.1.6 bash setup.sh
#
# Script nay lam 3 viec lien nhau:
#   1. Tai repo LGtv-Webos-homeskin ve may (khong can git: dung tarball GitHub).
#   2. Ghep noi ares voi tivi (chi lan dau; neu may da ghep noi thi bo qua).
#   3. Chay install.sh de dong bo app + cai launcher len tivi.
#
# NHUNG BUOC KHONG THE TU DONG (cua bao mat LG, van can ban tay):
#   - Tren tivi: cai app Developer Mode, bat Dev Mode Status + Key Server,
#     ghi lai IP tivi va Passphrase (6 ky tu) truoc khi chay script.
#   - Khi script hoi passphrase: go dung ma hien tren tivi.
#   - Khi tivi hien bang hoi ket noi (SSAP) luc dong bo: bam Dong y tren tivi.
#   - Buoc ares install thuong mat 1-2 phut, khong phai treo.
set -euo pipefail

REPO_OWNER="khuonguyenhcm-bit"
REPO_NAME="LGtv-Webos-homeskin"
REPO_URL="https://github.com/${REPO_OWNER}/${REPO_NAME}.git"
TARBALL_URL="https://codeload.github.com/${REPO_OWNER}/${REPO_NAME}/tar.gz/refs/heads/main"
DEVICE="${DEVICE:-lgtv}"
INSTALL_DIR="${INSTALL_DIR:-$HOME/${REPO_NAME}}"

# Doc tu terminal, khong doc tu stdin: khi chay dang curl | bash thi stdin
# la chinh script dang tai ve, doc tu do se lam hong luong chay.
ask() {
  local _var="$1" _prompt="$2" _val=""
  if [ -r /dev/tty ]; then printf '%s' "$_prompt" > /dev/tty; IFS= read -r _val < /dev/tty || true
  else printf '%s' "$_prompt"; IFS= read -r _val || true; fi
  printf -v "$_var" '%s' "$_val"
}

need() {
  command -v "$1" >/dev/null 2>&1 || {
    echo "Thieu cong cu: $1" >&2
    case "$1" in
      node) echo "Cai Node.js LTS tu nodejs.org roi chay lai script." >&2 ;;
      python3) echo "Cai Python 3 roi chay lai script." >&2 ;;
      curl) echo "Cai curl roi chay lai script." >&2 ;;
    esac
    exit 1
  }
}
need node
need python3
need curl

ares() {
  if command -v "ares-$1" >/dev/null 2>&1; then "ares-$1" "${@:2}"
  else npx -y -p @webos-tools/cli "ares-$1" "${@:2}"; fi
}

# --- 1. Lay IP tivi ---
if [ -z "${TV_HOST:-}" ]; then
  ask TV_HOST 'IP cua tivi (xem trong app Developer Mode tren tivi): '
fi
[ -n "$TV_HOST" ] || { echo "Chua co IP tivi, dung lai." >&2; exit 1; }
export TV_HOST

# --- 2. Tai repo (neu dang o trong thu muc repo thi dung luon, khong tai lai) ---
if [ -f ./install.sh ] && [ -f ./sync-apps.py ]; then
  INSTALL_DIR="$PWD"
  echo "Dang o trong thu muc repo, dung luon: $INSTALL_DIR"
elif [ -d "$INSTALL_DIR" ] && [ -f "$INSTALL_DIR/install.sh" ]; then
  echo "Repo da co san, dung luon: $INSTALL_DIR"
else
  echo "Dang tai $REPO_NAME ve $INSTALL_DIR ..."
  TMPDIR="$(mktemp -d)"
  trap 'rm -rf "$TMPDIR"' EXIT
  curl -fsSL "$TARBALL_URL" -o "$TMPDIR/repo.tar.gz"
  mkdir -p "$INSTALL_DIR"
  tar -xzf "$TMPDIR/repo.tar.gz" -C "$INSTALL_DIR" --strip-components=1
  echo "Da tai xong."
fi
cd "$INSTALL_DIR"

# --- 3. Ghep noi ares (lan dau) ---
# Khong tu doan trang thai ghep noi tu file .lgtv-key.json (do la khoa SSAP
# cua sync-apps.py, khac voi khoa ares), nen hoi thang nguoi dung.
PAIRED=""
if [ -n "${SKIP_PAIR:-}" ]; then
  PAIRED="y"
else
  ask PAIRED 'May nay da ghep noi ares voi tivi nay truoc day chua? (y/n, mac dinh n): '

fi
case "${PAIRED:-n}" in
  y|Y) echo "Bo qua ghep noi, dung cau hinh ares san co." ;;
  *)
    echo "Ghep noi ares voi tivi $TV_HOST ..."
    echo "Buoc 1/3: dang ky thiet bi..."
    ares setup-device -a "$DEVICE" -i "{'host':'$TV_HOST','port':'9922','username':'prisoner'}"
    echo "Buoc 2/3: lay khoa — go passphrase (6 ky tu) hien trong app Developer Mode khi duoc hoi."
    ares novacom --device "$DEVICE" --getkey
    # Luu y: passphrase can nhap 2 lan — lan 1 cho ares-novacom o buoc 2,
    # lan 2 o day de luu cau hinh (dung quy trinh 3 lenh goc trong HUONG-DAN.md).
    ask PASSPHRASE 'Passphrase (6 ky tu, nhu trong app Developer Mode): '
    if [ -n "${PASSPHRASE:-}" ]; then
      echo "Buoc 3/3: luu cau hinh ghep noi..."
      ares setup-device -m "$DEVICE" -i "{'privatekey':'lgtv_webos','passphrase':'$PASSPHRASE'}"
    else
      echo "Chua nhap passphrase nen bo qua buoc 3/3. Neu buoc cai sau bao loi ghep noi, chay lai script va nhap passphrase o day."
    fi
    ;;
esac

# --- 4. Cai launcher (dong bo app + dong goi + cai + mo) ---
echo "Cai launcher len tivi $TV_HOST ..."
echo "Luu y: khi tivi hien bang hoi ket noi, bam Dong y tren tivi; buoc install mat 1-2 phut."
TV_HOST="$TV_HOST" bash install.sh

echo ""
echo "Xong! Launcher moi da mo tren tivi."
echo "Tuy chon — de nut Home luon ve launcher nay (may nay phai luon bat):"
echo "  bash home-watch-mac.sh install \"\$(pwd)\" $TV_HOST"
echo "Go ra: bash home-watch-mac.sh uninstall"
