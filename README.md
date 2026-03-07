# ChatApp-project
## 🚀 Getting Started

### Install Dependencies

```bash
npm install
```

### Run Development Server

```bash
npm run dev
```

---

## 🔀 Git Workflow

### Quy tắc làm việc với Git

⚠️ **QUAN TRỌNG**: Không commit trực tiếp lên `main` hoặc `develop`

### Quy trình làm việc cho mỗi task:

1. **Cập nhật nhánh develop**

   ```bash
   git checkout develop
   git pull origin develop
   ```

2. **Tạo nhánh mới cho task**

   ```bash
   git checkout -b dev/task-xxx
   ```

   Ví dụ: `dev/task-01`, `dev/task-02`, `dev/task-login`, v.v.

3. **Làm việc và commit**

   ```bash
   # Sau khi code xong
   git add .
   git commit -m "feat: mô tả task"
   ```

4. **Push nhánh lên remote**

   ```bash
   git push origin dev/task-xxx
   ```

5. **Tạo Pull Request**

   - Tạo PR từ `dev/task-xxx` → `develop`

### Ví dụ minh họa:

```bash
# Task 1: Public Layout
git checkout develop
git pull origin develop
git checkout -b dev/task-01-public-layout
# ... code xong ...
git add .
git commit -m "feat: implement public layout with header and footer"
git push origin dev/task-01-public-layout
# Tạo PR: dev/task-01-public-layout → develop trên github
```

---

## 📋 Task List
