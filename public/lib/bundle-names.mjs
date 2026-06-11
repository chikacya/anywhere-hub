export const BUNDLE_NAMES = {
  "cn.ninebot.segway": "九号出行",
  "com.360buy.jdmobile": "京东",
  "com.alipay.iphoneclient": "支付宝",
  "com.apple.appstore": "App Store",
  "com.apple.mobilesafari": "Safari",
  "com.apple.testflight": "TestFlight",
  "com.argsment.anywhere": "Anywhere",
  "com.autonavi.amap": "高德地图",
  "com.bytecrossing.egern": "Egern",
  "com.bytedance.ee.lark": "飞书",
  "com.bytedance.ios.doubaoime": "豆包输入法",
  "com.google.ios.youtube": "YouTube",
  "com.google.ios.youtubemusic": "YouTube Music",
  "com.hupu.games.pro": "虎扑",
  "com.manmanbuy.bijia": "慢慢买",
  "com.meituan.imeituan": "美团",
  "com.netease.cloudmusic": "网易云音乐",
  "com.openai.chat": "ChatGPT",
  "com.sina.weibo": "微博",
  "com.spotify.client": "Spotify",
  "com.ss.iphone.ugc.aweme": "抖音",
  "com.taobao.fleamarket": "闲鱼",
  "com.taobao.taobao4iphone": "淘宝",
  "com.tencent.mqq": "QQ",
  "com.tencent.qqmail": "QQ 邮箱",
  "com.tencent.wetype": "微信输入法",
  "com.tencent.xin": "微信",
  "com.xiaomi.mihome": "米家",
  "com.xiaojukeji.esp": "滴滴",
  "com.xingin.discover": "小红书",
  "com.xunmeng.pinduoduo": "拼多多",
  "tv.danmaku.bilianime": "哔哩哔哩",
};

export function displayBundleName(bundleID) {
  const key = String(bundleID || "").toLowerCase();
  const name = BUNDLE_NAMES[key];
  return name ? `${name} (${bundleID})` : bundleID;
}
