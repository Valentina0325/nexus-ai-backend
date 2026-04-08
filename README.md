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
  {
    "mobile": "13300000000",
    "password": "123456"
  }

### 2️⃣ 文件上传
- **POST** `/api/upload`

- **Header**: `Authorization: Bearer <token>`

- **Body**: `file (multipart/form-data)`

### 3️⃣ AI 对话
- **POST** `/api/chat`

- **Header**: `Authorization: Bearer <token>`

- **Body**: `{ "messages": [...] }`

-**响应**: `流式 SSE`

## 🚀 本地运行
```bash
git clone https://github.com/Valentina0325/nexus-ai-assistant-backend.git
cd nexus-ai-assistant-backend
npm install
# 创建 .env 文件，配置 JWT_SECRET_KEY 和 ZHIPU_API_KEY
npm run dev

## 🔗 前端仓库
👉 ` https://github.com/Valentina0325/nexus-ai-assistant`
