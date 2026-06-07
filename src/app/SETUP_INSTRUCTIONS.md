# LifePath - Supabase Setup Instructions

## 🚀 Quick Setup

Your LifePath app is now connected to Supabase! Follow these steps to complete the setup:

### 1. Set Up Database Tables

1. Go to your Supabase dashboard: https://usfevtqyobjjkftjzsio.supabase.co
2. Navigate to the **SQL Editor** tab
3. Copy the entire contents of `/database-setup.sql`
4. Paste it into the SQL Editor
5. Click **Run** to create all tables, indexes, and security policies

### 2. Enable Email Authentication (Optional)

By default, Supabase requires email confirmation. To disable it for faster testing:

1. Go to **Authentication** → **Providers** → **Email**
2. Toggle **"Confirm email"** to OFF
3. Save changes

### 3. Test Your App

1. **Sign Up**: Create a new account with any email and password
2. **Create Goals**: Click the + button in the sidebar
3. **Add Subtasks**: Use the AI Strategist or add manually
4. **Drag Timeline**: Move and resize your goal bars
5. **Add Milestones**: Track important dates

---

## 📊 Database Schema

The app uses 4 main tables:

- **goals**: Main goals with dates, status, and color
- **subtasks**: Tasks within goals (duration + offset)
- **goal_milestones**: Milestone markers within goals
- **life_milestones**: Global milestone events

All tables have Row Level Security (RLS) enabled, ensuring users can only access their own data.

---

## ✅ Features Now Active

✅ **Real Authentication** - Secure user accounts with Supabase Auth  
✅ **Data Persistence** - All data is saved to PostgreSQL  
✅ **Automatic Sync** - Changes save instantly  
✅ **Multi-device** - Access your goals from anywhere  
✅ **Secure** - Row-level security keeps your data private  

---

## 🔧 Troubleshooting

**Can't log in after sign up?**
- Check if email confirmation is required
- Look for verification email in your inbox
- Or disable email confirmation (see step 2)

**Data not saving?**
- Make sure you ran the SQL setup script
- Check browser console for errors
- Verify RLS policies are enabled

**Need help?**
- Check Supabase logs in the dashboard
- Review the SQL setup script for any errors

---

## 🎯 Next Steps

- Customize your goals and milestones
- Use the AI Strategist to break down complex goals
- Export to `.ics` to sync with your calendar
- Drag and resize timeline bars to adjust dates

Enjoy planning your life with LifePath! 🚀
