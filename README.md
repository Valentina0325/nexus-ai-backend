
---

## 🟢 后端仓库 README.md（复制到你的后端仓库）

```markdown
# 🧠 Nexus AI 助手 · 后端

> Node.js + Express 服务，提供用户认证、文件解析、流式 AI 对话代理与临时文件自动清理。

[![Railway](https://img.shields.io/badge/Railway-部署成功-0b0d0e?style=flat-square&logo=railway)](https://nexus-ai-backend-production-3faf.up.railway.app)
[![Express](https://img.shields.io/badge/Express-4.x-000000?style=flat-square&logo=express)](https://expressjs.com/)

---

## ✨ 功能概述

- 🔐 **用户登录** – JWT 鉴权，测试账号硬编码（演示用）  
- 📂 **文件上传** – 支持 txt / pdf / docx / xlsx，自动提取文本内容  
- 🤖 **AI 对话代理** – 对接智谱 AI GLM-4-Flash，流式响应（SSE）  
- 🧹 **定时清理** – 每天凌晨 2 点删除超过 24 小时的临时文件  
- 🌐 **跨域支持** – 已配置 CORS，可被任意前端调用  

---

## 📡 API 接口文档

基础地址（生产）：`https://nexus-ai-backend-production-3faf.up.railway.app`

### 1️⃣ 用户登录
- **POST** `/api/login`
- **Body**：
  ```json
  { "mobile": "13300000000", "password": "123456" }

## 响应：
json
{ "code": 0, "data": { "token": "jwt...", "userInfo": {...} } }
