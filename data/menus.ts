/**
 * Daftar menu untuk sanity test.
 * Tambah/kurangi sesuai aplikasi: satu entri = satu test otomatis.
 *
 * - name        : teks menu di navigasi
 * - path        : URL halaman list (dipakai untuk verifikasi)
 * - hasDetail   : true jika baris di list bisa diklik menuju halaman detail
 */
export interface MenuItem {
  name: string;
  path: string;
  hasDetail: boolean;
}

export const menus: MenuItem[] = [
  {
    name: "Master Users",
    path: "/utility/master-data/master-users",
    hasDetail: true,
  },
  {
    name: "Mater Groups",
    path: "/utility/master-data/master-groups",
    hasDetail: true,
  },
  {
    name: "Master Servers",
    path: "/utility/master-data/master-servers",
    hasDetail: true,
  },
  {
    name: "Master Record Rules",
    path: "/utility/master-data/record-rules",
    hasDetail: true,
  },
];
