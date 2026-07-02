# 发布签名与公证（Developer ID）

目的：让 GitHub Release 的 DMG 用**固定的 Developer ID 身份**签名并经 Apple 公证，
这样 **macOS 的权限授权（麦克风 / 辅助功能）能跨版本更新保留**，且用户下载后
不会被 Gatekeeper 拦截（无需右键「打开」）。

原理：TCC 把授权绑定到 App 的 code signature designated requirement。Developer ID
签名的 DR 是 `identifier "com.orbit.app" and anchor apple generic and
certificate leaf[subject.OU] = <TeamID>`——只要 **bundle id（`com.orbit.app`）和
Team ID 不变**，未来所有版本都被 TCC 视作同一个 App，授权自动保留。

> ⚠️ 一次性代价：从现有 ad-hoc 版本切到首个 Developer ID 版本时，老用户仍需重新授权
> 一次（签名身份变了）；之后永久保留。

---

## 一、需要准备的东西

1. **Apple Developer Program 账号**（$99/年）。
2. **Developer ID Application 证书**（不是 "Apple Distribution"，也不是 "Development"）。
3. **App Store Connect API Key（.p8）**——用于 `notarytool` 公证（比 Apple ID +
   专用密码更稳，不受账号 2FA 影响）。

---

## 二、导出 Developer ID 证书为 .p12

在装有该证书私钥的 Mac 上（通常是你申请证书的那台）：

1. 打开「钥匙串访问」→ 登录钥匙串 → 「我的证书」。
2. 找到 **Developer ID Application: 你的名字 (TEAMID)**，右键「导出」为 `.p12`，
   设一个导出密码（记住它 → 就是 `MACOS_CERT_PASSWORD`）。
3. 转成 base64（供 GitHub secret 使用）：
   ```bash
   base64 -i DeveloperID.p12 | pbcopy   # 已复制到剪贴板
   ```
   查看 Team ID：`security find-identity -v -p codesigning | grep "Developer ID Application"`。

## 三、创建 App Store Connect API Key

1. 登录 [App Store Connect](https://appstoreconnect.apple.com/) → Users and Access →
   Integrations → **App Store Connect API** → 生成一个 Key，角色选 **Developer**（含公证权限即可）。
2. 下载 `AuthKey_XXXXXX.p8`（**只能下载一次**）。记下：
   - **Key ID**（如 `ABC123DEF4`）→ `MACOS_NOTARY_KEY_ID`
   - **Issuer ID**（页面顶部的 UUID）→ `MACOS_NOTARY_ISSUER_ID`
3. base64：
   ```bash
   base64 -i AuthKey_XXXXXX.p8 | pbcopy
   ```

## 四、在 GitHub 仓库配置 Secrets

Settings → Secrets and variables → Actions → New repository secret，添加 5 个：

| Secret | 值 |
| --- | --- |
| `MACOS_CERT_P12_BASE64` | 第二步得到的 .p12 base64 |
| `MACOS_CERT_PASSWORD` | 导出 .p12 时设的密码 |
| `MACOS_NOTARY_KEY_P8_BASE64` | 第三步的 .p8 base64 |
| `MACOS_NOTARY_KEY_ID` | API Key 的 Key ID |
| `MACOS_NOTARY_ISSUER_ID` | App Store Connect Issuer ID |

配好后，推送 `v*` tag 触发 [release.yml](../.github/workflows/release.yml) 即可自动完成
签名 + 公证 + staple。若这些 secret 缺失，工作流会**回退到 ad-hoc**（仅供内部测试，装机每次要重授权）。

## 五、本地开发不受影响

本地 `./build.sh run` 仍用自签名 `Orbit Self-Signed` 证书（无需硬化运行时 / 公证），
授权跨本地重编译保留。Developer ID + 硬化运行时 + 公证只在 CI 发布路径上生效。
硬化运行时下麦克风访问需要 [`Orbit.entitlements`](../Orbit.entitlements) 里的
`com.apple.security.device.audio-input`（CI 签名时注入）。

## 六、验证一个已发布的 DMG

用户或你本地可这样确认公证生效：

```bash
spctl -a -vvv -t install Orbit-x.y.z-macos-arm64.dmg   # 应显示 accepted / Notarized Developer ID
xcrun stapler validate Orbit-x.y.z-macos-arm64.dmg      # 应显示 The validate action worked
```
