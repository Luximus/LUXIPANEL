const modules = {
  "pageTitle": "মডিউল",
  "header": {
    "heading": "মডিউল ও ইন্টিগ্রেশন",
    "subheading": "পার্শ্ব মেনুতে প্রদর্শিত প্রি-ইন্সটল্ড মডিউলগুলো সক্রিয় বা লুকান"
  },
  "search": {
    "placeholder": "মডিউল খুঁজুন..."
  },
  "tabs": {
    "all": "সব",
    "modules": "মডিউল",
    "integrations": "ইন্টিগ্রেশন",
    "visible": "দৃশ্যমান"
  },
  "stats": {
    "visible": "দৃশ্যমান:",
    "hidden": "লুকানো:",
    "systemNote": "সিস্টেম মডিউলগুলো প্রি-ইন্সটল্ড থাকে"
  },
  "categories": {
    "label": "বিভাগ",
    "all": "সব",
    "communication": "যোগাযোগ",
    "infrastructure": "অবকাঠামো",
    "security": "নিরাপত্তা",
    "developer": "ডেভেলপার"
  },
  "statusFilter": {
    "label": "অবস্থা",
    "all": "সব",
    "visible": "দৃশ্যমান",
    "hidden": "লুকানো"
  },
  "empty": {
    "title": "কোনো মডিউল পাওয়া যায়নি",
    "subtitle": "অন্য শব্দ বা বিভাগ দিয়ে চেষ্টা করুন"
  },
  "errors": {
    "loadTitle": "মডিউল লোডে ত্রুটি",
    "loadSubtitle": "মডিউলের তালিকা পাওয়া যায়নি"
  },
  "labels": {
    "metaVersion": "সংস্করণ",
    "metaInstalls": "ইনস্টলেশন",
    "metaRating": "রেটিং",
    "metaAuthor": "লেখক",
    "metaCreatedAt": "তৈরির তারিখ",
    "metaUpdatedAt": "সর্বশেষ আপডেট",
    "kindIntegration": "ইন্টিগ্রেশন",
    "kindModule": "মডিউল",
    "tagFree": "বিনামূল্যে",
    "tagLicense": "লাইসেন্স প্রয়োজন",
    "statusVisible": "মেনুতে দৃশ্যমান",
    "statusHidden": "লুকানো",
    "dragHandle": "পুনর্বিন্যাসের জন্য টেনে আনুন",
    "menuToggle": "সাইডবার মেনুতে দেখান",
    "moduleToggle": "মডিউল সক্রিয় করুন",
    "fabToggle": "ভাসমান বোতাম দেখান"
  },
  "toasts": {
    "moduleVisible": "{name} দৃশ্যমান",
    "moduleHidden": "{name} লুকানো",
    "moduleVisibleWithDeps": "{name} দৃশ্যমান (এছাড়াও সক্রিয়: {deps})",
    "moduleHiddenWithDeps": "{name} লুকানো (এছাড়াও সক্রিয়: {deps})",
    "moduleUpdateError": "{name} আপডেট করা যায়নি",
    "sidebarShown": "{name} মেনুতে প্রদর্শিত",
    "sidebarHidden": "{name} মেনু থেকে লুকানো",
    "fabShown": "{name}: ভাসমান বোতাম সক্রিয়",
    "fabHidden": "{name}: ভাসমান বোতাম নিষ্ক্রিয়",
    "orderSaved": "ক্রম আপডেট হয়েছে",
    "orderError": "ক্রম সংরক্ষণ করা যায়নি",
    "orderHttpError": "ক্রম সংরক্ষণ করা যায়নি ({status})"
  }
} as const;

export default modules;
