export interface MenuItem {
  group: string;
  name: string;
  path: string;
  heading: string;
  hasTable?: boolean;
  hasDetail?: boolean; // default true; isi false jika baris tidak bisa dibuka
  allowEmpty?: boolean; // default false; isi true jika tabel boleh kosong
}

export interface ModuleDef {
  key: string; // dipakai sebagai tag: @mes
  name: string;
  buttonLabel: string; // teks tombol modul di halaman pilih modul
  menus: MenuItem[];
}

export const modules: ModuleDef[] = [
  {
    key: "mes",
    name: "MES",
    buttonLabel: "MES",
    menus: [
      {
        group: "Master Data",
        path: "/mes/master-data/material-masters",
        name: "Material Masters",
        heading: "Material Masters",
      },
      {
        group: "Master Data",
        path: "/mes/master-data/spec-sections",
        name: "Spec Sections",
        heading: "Spec Sections",
      },
      {
        group: "Master Data",
        path: "/mes/master-data/spec-attributes",
        name: "Spec Attributes",
        heading: "Spec Attributes",
      },
      {
        group: "Master Data",
        path: "/mes/master-data/bill-of-materials",
        name: "Bill of Materials",
        heading: "Bill of Materials",
      },
      {
        group: "Master Data",
        path: "/mes/master-data/product-specifications",
        name: "Product Specifications",
        heading: "Product Specifications",
      },
      {
        group: "Master Data",
        path: "/mes/master-data/routing-masters",
        name: "Routing Masters",
        heading: "Routing Masters",
      },
      {
        group: "Master Data",
        path: "/mes/master-data/routing-methods",
        name: "Routing Method",
        heading: "Routing Method",
      },
      {
        group: "Master Data",
        path: "/mes/master-data/code-validation-rule",
        name: "Code Validation Rule",
        heading: "Code Validation Rule",
      },
    ],
  },
  {
    key: "wms",
    name: "WMS",
    buttonLabel: "WMS",
    menus: [
      {
        group: "Master Data",
        path: "/wms/master-data/bin-masters",
        name: "Bin Masters",
        heading: "Bin Masters",
      },
      {
        group: "Reporting",
        path: "/wms/reporting/equipment-room-layout",
        name: "Equipment Room Layout",
        heading: "Equipment Room Layout",
      },
      // tambah menu MES lain di sini
    ],
  },
  {
    key: "utility",
    name: "UTILITY",
    buttonLabel: "UTILITY",
    menus: [
      {
        group: "Master Data",
        path: "/utility/master-data/master-users",
        name: "Master Users",
        heading: "Users",
      },
      {
        group: "Master Data",
        path: "/utility/master-data/master-groups",
        name: "Master Groups",
        heading: "Groups",
      },
      {
        group: "Master Data",
        path: "/utility/master-data/master-servers",
        name: "Master Servers",
        heading: "Servers",
      },
      {
        group: "Master Data",
        path: "/utility/master-data/record-rules",
        name: "Master Record Rules",
        heading: "Record Rules",
      },
      {
        group: "Master Data",
        path: "/utility/master-data/operator-login-qr-code",
        name: "Operator Login QR Code",
        heading: "Operator Login QR Code",
        hasDetail: false,
      },
      {
        group: "Master Data",
        path: "/utility/master-data/user-guidances",
        name: "User Guidances",
        heading: "User Guidances",
      },
      {
        group: "Master Data",
        path: "/utility/master-data/master-plants",
        name: "Master Plants",
        heading: "Master Plants",
      },
      {
        group: "Master Data",
        path: "/utility/master-data/master-business-partners",
        name: "Master Business Partners",
        heading: "Master Business Partners",
      },
      {
        group: "Configuration",
        path: "/utility/configuration/system-configuration",
        name: "System Configuration",
        heading: "System Configuration",
        hasDetail: false,
        hasTable: false,
      },
      {
        group: "Configuration",
        path: "/utility/configuration/mail-groups",
        name: "Mail Groups",
        heading: "Mail Groups",
      },
      {
        group: "Configuration",
        path: "/utility/configuration/job-scheduler",
        name: "Job Scheduler",
        heading: "Job Scheduler",
      },
      {
        group: "Configuration",
        path: "/utility/configuration/approval-workflows",
        name: "Approval Workflows",
        heading: "Approval Workflows",
      },
      {
        group: "Log",
        path: "/utility/log/email-logs",
        name: "Email Logs",
        heading: "Email Logs",
      },
    ],
  },
  {
    key: "master-data",
    name: "Master Data",
    buttonLabel: "MASTER-DATA",
    menus: [
      {
        group: "Configurations",
        path: "/master-data/configurations/digi-tag-masters",
        name: "Digi Tag Masters",
        heading: "Digi Tag Masters",
      },
      {
        group: "Equipments",
        path: "/master-data/equipments/equipment-masters",
        name: "Equipment Masters",
        heading: "Equipment Masters",
      },
      {
        group: "Manufacturing Processes",
        path: "/master-data/manufacturing-processes/process-masters",
        name: "Process Masters",
        heading: "Process Masters",
      },
      {
        group: "Plant Structures",
        path: "/master-data/plant-structures/area-masters",
        name: "Area Masters",
        heading: "Area Masters",
      },
      {
        group: "Plant Structures",
        path: "/master-data/plant-structures/storage-locations",
        name: "Storage Locations",
        heading: "Storage Locations",
      },
      {
        group: "Plant Structures",
        path: "/master-data/plant-structures/rack-masters",
        name: "Rack Masters",
        heading: "Rack Masters",
      },
      {
        group: "Plant Structures",
        path: "/master-data/plant-structures/bin-masters",
        name: "Bin Masters",
        heading: "Bin Masters",
      },
      {
        group: "Plant Structures",
        path: "/master-data/plant-structures/production-lines",
        name: "Production Lines",
        heading: "Production Lines",
      },
      {
        group: "Plant Structures",
        path: "/master-data/plant-structures/workstations",
        name: "Workstations",
        heading: "Workstations",
      },
      {
        group: "Product Masters",
        path: "/master-data/product-masters/model-masters",
        name: "Model Masters",
        heading: "Model Masters",
      },
      {
        group: "Product Masters",
        path: "/master-data/product-masters/material-types",
        name: "Material Types",
        heading: "Material Types",
      },
      {
        group: "Product Masters",
        path: "/master-data/product-masters/material-identities",
        name: "Material Identities",
        heading: "Material Identities",
      },
      // tambah menu MES lain di sini
    ],
  },

  // tambah modul lain di sini
];
