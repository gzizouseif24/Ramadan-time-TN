document.addEventListener('DOMContentLoaded', function() {
    // مراجع العناصر
    const prayerTimeDisplay = document.getElementById('prayer-time');
    const prayerLabel = document.getElementById('prayer-label');
    const countdownLabel = document.getElementById('countdown-label');
    const statusMessageDisplay = document.getElementById('status-message');
    const hijriDateDisplay = document.getElementById('hijri-date');
    const gregorianDateDisplay = document.getElementById('gregorian-date');
    const countdownDisplay = document.getElementById('countdown');
    const locationSelect = document.getElementById('location-select');
    const notificationElement = document.getElementById('notification');
    const darkModeToggle = document.getElementById('dark-mode-toggle');
    const mainTitle = document.getElementById('main-title');
    const debugInfoElement = document.getElementById('debug-info');
    
    // متغيرات أوقات الصلاة
    let fajrTime = null;
    let maghribTime = null;
    let currentCity = "Tunis";
    let prayerTimesData = null;
    let isFajrMode = false;
    let targetTime = null;
    
    // وظيفة تنسيق الوقت بتنسيق 12 ساعة مع صباحاً/مساءً
    function formatTime(timeString) {
        if (!timeString) {
            console.error('تم تمرير وقت فارغ إلى formatTime!');
            return '--:-- --';
        }
        
        // تحويل التنسيق من hh:mm AM/PM إلى تنسيق عربي
        const [timePart, ampm] = timeString.split(' ');
        if (!timePart || !ampm) {
            console.error('تنسيق الوقت غير صحيح:', timeString);
            return timeString; // إرجاع النص الأصلي إذا كان التنسيق غير صحيح
        }
        
        const [hours, minutes] = timePart.split(':').map(Number);
        
        // 12-hour format with Arabic AM/PM
        const arabicAmPm = ampm === 'AM' ? 'صباحاً' : 'مساءً';
        const hour12 = hours === 0 ? 12 : (hours > 12 ? hours - 12 : hours);
        
        return `${hour12}:${minutes.toString().padStart(2, '0')} ${arabicAmPm}`;
    }
    
    // وظيفة تحويل نص الوقت إلى كائن Date
    function timeStringToDate(timeString, currentDate) {
        if (!timeString) {
            console.error('تم تمرير وقت فارغ إلى timeStringToDate!');
            return new Date(); // إرجاع الوقت الحالي في حالة الخطأ
        }
        
        const date = new Date(currentDate);
        const [timePart, ampm] = timeString.split(' ');
        let [hours, minutes] = timePart.split(':').map(Number);
        
        if (ampm === 'PM' && hours < 12) hours += 12;
        if (ampm === 'AM' && hours === 12) hours = 0;
        
        date.setHours(hours, minutes, 0, 0);
        console.log('تحويل وقت:', timeString, 'إلى تاريخ:', date, 'بالساعات:', hours, 'بالدقائق:', minutes);
        
        // إضافة معلومات التصحيح إلى الصفحة
        updateDebugInfo(`آخر تحويل: ${timeString} → ${date.toLocaleTimeString('ar')}`);
        
        return date;
    }
    
    // إضافة وظيفة جديدة لتحديث معلومات التصحيح
    function updateDebugInfo(message) {
        if (debugInfoElement) {
            debugInfoElement.textContent = message;
        }
    }
    
    // تحميل مواقيت الصلاة من ملف JSON
    async function loadPrayerTimes() {
        // قائمة بالمسارات المحتملة للملف
        const possiblePaths = [
            './Ramadan_prayer_times/ramdan_praying_times.json',
            '/Ramadan_prayer_times/ramdan_praying_times.json',
            '../Ramadan_prayer_times/ramdan_praying_times.json',
            'Ramadan_prayer_times/ramdan_praying_times.json'
        ];
        
        let loaded = false;
        let lastError = null;
        
        // تجربة كل مسار حتى ينجح أحدها
        for (const path of possiblePaths) {
            if (loaded) break;
            
            try {
                console.log(`محاولة تحميل البيانات من المسار: ${path}`);
                const response = await fetch(path);
                if (!response.ok) {
                    throw new Error(`فشل تحميل مواقيت الصلاة من ${path} (${response.status})`);
                }
                
                prayerTimesData = await response.json();
                console.log(`تم تحميل البيانات بنجاح من المسار: ${path}`);
                
                // عرض معلومات للتأكد من أن البيانات تحميلها صحيح
                if (prayerTimesData && prayerTimesData.Tunis) {
                    console.log(`تم العثور على ${prayerTimesData.Tunis.length} يوم من بيانات الصلاة لتونس`);
                }
                
                // تحديث مواقيت الصلاة بعد تحميل البيانات
                updatePrayerTimes();
                
                // تحديد الوضع الأولي (الفجر أو المغرب) بناءً على الوقت الحالي
                initializeMode();
                
                // تحديث العد التنازلي مباشرة بعد تحميل البيانات
                updateCountdown();
                
                loaded = true;
                statusMessageDisplay.textContent = '';
                updateDebugInfo(`تم تحميل البيانات من: ${path}`);
                
            } catch (error) {
                console.error(`خطأ في تحميل مواقيت الصلاة من ${path}:`, error);
                lastError = error;
            }
        }
        
        // إذا لم ينجح أي مسار
        if (!loaded) {
            statusMessageDisplay.textContent = `خطأ في تحميل مواقيت الصلاة: ${lastError.message}`;
            console.error('جميع محاولات تحميل البيانات فشلت:', lastError);
            updateDebugInfo(`فشل تحميل البيانات: ${lastError.message}`);
        }
    }
    
    // تحديث مواقيت الصلاة استناداً إلى المدينة المحددة والتاريخ الحالي
    function updatePrayerTimes() {
        if (!prayerTimesData) {
            console.error('بيانات مواقيت الصلاة غير متوفرة!');
            return;
        }
        
        const now = new Date();
        // تنسيق التاريخ بشكل DD/MM/YY للمطابقة مع ملف JSON
        const day = now.getDate().toString().padStart(2, '0');
        const month = (now.getMonth() + 1).toString().padStart(2, '0');
        const year = now.getFullYear().toString().slice(-2);
        const formattedDate = `${day}/${month}/${year}`;
        
        console.log('تحديث مواقيت الصلاة للتاريخ:', formattedDate);
        
        // الحصول على بيانات المدينة المحددة
        const cityData = prayerTimesData[currentCity];
        
        // تحديث العنوان بناءً على المدينة المحددة
        updateTitleByLocation(currentCity);
        
        if (!cityData) {
            console.error('لا توجد بيانات لمدينة:', currentCity);
            statusMessageDisplay.textContent = 'لا توجد بيانات لهذه المدينة';
            return;
        }
        
        // البحث عن مواقيت اليوم الحالي
        const todayEntry = cityData.find(entry => entry.Date === formattedDate);
        
        if (todayEntry) {
            fajrTime = todayEntry.Fajr;
            maghribTime = todayEntry.Maghrib;
            
            console.log('تم العثور على مواقيت اليوم:', formattedDate);
            console.log('وقت الفجر:', fajrTime);
            console.log('وقت المغرب:', maghribTime);
            
            updateTimeDisplay();
            statusMessageDisplay.textContent = '';
        } else {
            // إذا لم يتم العثور على مواقيت لليوم الحالي، ابحث عن أقرب تاريخ
            console.log(`لم يتم العثور على مواقيت ليوم ${formattedDate}، جاري البحث عن أقرب تاريخ...`);
            
            // تحويل تاريخ اليوم إلى كائن Date للمقارنة
            const today = new Date(
                parseInt(`20${year}`), 
                parseInt(month) - 1, 
                parseInt(day)
            );
            
            // تحويل كل تاريخ في البيانات إلى كائن Date للمقارنة
            let closestEntry = null;
            let minDiff = Infinity;
            
            for (const entry of cityData) {
                const [entryDay, entryMonth, entryYear] = entry.Date.split('/');
                const entryDate = new Date(
                    parseInt(`20${entryYear}`), 
                    parseInt(entryMonth) - 1, 
                    parseInt(entryDay)
                );
                
                const diff = Math.abs(entryDate - today);
                if (diff < minDiff) {
                    minDiff = diff;
                    closestEntry = entry;
                }
            }
            
            if (closestEntry) {
                fajrTime = closestEntry.Fajr;
                maghribTime = closestEntry.Maghrib;
                
                console.log('تم العثور على أقرب تاريخ:', closestEntry.Date);
                console.log('وقت الفجر:', fajrTime);
                console.log('وقت المغرب:', maghribTime);
                
                updateTimeDisplay();
                statusMessageDisplay.textContent = `عرض مواقيت يوم ${closestEntry.Date}`;
            } else {
                console.error('لم يتم العثور على أي مواقيت للصلاة!');
                statusMessageDisplay.textContent = 'لم يتم العثور على مواقيت الصلاة';
                prayerTimeDisplay.textContent = '--:--';
            }
        }
    }
    
    // تحديث عرض الوقت استناداً إلى الوقت الحالي
    function updateTimeDisplay() {
        const now = new Date();
        
        if (isFajrMode) {
            // وقت السحور (الفجر)
            prayerLabel.textContent = 'وقت الفجر';
            countdownLabel.textContent = 'يوفا السحور بعد :';
            prayerTimeDisplay.textContent = formatTime(fajrTime);
            
            // حساب وقت العد التنازلي للفجر
            const fajrDate = timeStringToDate(fajrTime, now);
            targetTime = fajrDate;
            
            // تصحيح الحساب لليوم التالي فقط إذا كان وقت الفجر قد مر وليس متوقع اليوم
            if (fajrDate < now) {
                const tomorrow = new Date(now);
                tomorrow.setDate(tomorrow.getDate() + 1);
                targetTime = timeStringToDate(fajrTime, tomorrow);
                console.log('تم تعيين وقت الفجر لليوم التالي:', targetTime);
            }
        } else {
            // وقت الإفطار (المغرب)
            prayerLabel.textContent = 'وقت المغرب';
            countdownLabel.textContent = 'يوفا الصيام بعد :';
            prayerTimeDisplay.textContent = formatTime(maghribTime);
            
            // حساب وقت العد التنازلي للمغرب
            const maghribDate = timeStringToDate(maghribTime, now);
            targetTime = maghribDate;
            
            // تصحيح الحساب لليوم التالي فقط إذا كان وقت المغرب قد مر وليس متوقع اليوم
            if (maghribDate < now) {
                const tomorrow = new Date(now);
                tomorrow.setDate(tomorrow.getDate() + 1);
                targetTime = timeStringToDate(maghribTime, tomorrow);
                console.log('تم تعيين وقت المغرب لليوم التالي:', targetTime);
            }
        }
        
        // تحديث العنوان بناءً على الوقت الحالي
        updateTitleByLocation(currentCity);
        
        // تطبيق تأثير التحديث
        prayerTimeDisplay.classList.add('time-update');
        setTimeout(() => {
            prayerTimeDisplay.classList.remove('time-update');
        }, 500);

        // تصحيح العد التنازلي مباشرة
        updateCountdown();
    }
    
    // تحديث التاريخ
    function updateDate() {
        const now = new Date();
        
        // التاريخ الميلادي
        const options = { 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric',
            weekday: 'long'
        };
        gregorianDateDisplay.textContent = now.toLocaleDateString('ar', options);
        
        // حساب التاريخ الهجري التقريبي لرمضان 2025
        // في مارس 2025، رمضان يبدأ تقريبًا في 1 مارس
        const dayOfMonth = now.getDate();
        const hijriDay = dayOfMonth; // تقريب بسيط
        hijriDateDisplay.textContent = `${hijriDay} رمضان 1446`;
    }
    
    // تحديث العنوان بناءً على المدينة المحددة والوقت
    function updateTitleByLocation(city) {
        let cityName = "";
        switch(city) {
            case "Tunis":
                cityName = "تونس";
                break;
            case "Djerba":
                cityName = "جربة";
                break;
            case "Monastir":
                cityName = "المنستير";
                break;
            default:
                cityName = "تونس";
        }
        
        // تحديد نوع الوقت (سحور أو إفطار) بناءً على الوقت الحالي
        const timeType = isFajrMode ? "السحور" : "الإفطار";
        
        mainTitle.textContent = `وقت ${timeType} في ${cityName}`;
        document.title = `وقت ${timeType} في ${cityName}`;
    }
    
    // تحديث العد التنازلي
    function updateCountdown() {
        if (!targetTime) {
            console.error('لم يتم تعيين وقت مستهدف للعد التنازلي!');
            return;
        }
        
        const now = new Date();
        
        // Calculate time difference
        let diff = targetTime - now;
        
        // Debugging - add this to HTML for visibility
        const debugInfo = `التوقيت المستهدف: ${targetTime.toLocaleTimeString('ar')} | الفرق: ${Math.floor(diff / 1000)} ثانية`;
        updateDebugInfo(debugInfo);
        
        // Check if prayer time has arrived
        if (diff <= 1000 && diff > -1000) {
            if (isFajrMode) {
                showNotification('حان الآن وقت السحور! بدأ وقت الصيام');
            } else {
                showNotification('حان الآن وقت الإفطار! تقبل الله صيامكم');
            }
            setTimeout(updateTimeDisplay, 2000);
        }
        
        // Handle case when the target time has passed
        if (diff <= 0) {
            // إذا كان الوقت قد انتهى، قم بتبديل الحالة وتحديث العرض
            if (Math.abs(diff) > 1000 * 60) { // إذا تجاوز الوقت بأكثر من دقيقة
                console.log('تم تبديل الوضع من', isFajrMode ? 'الفجر' : 'المغرب', 'إلى', !isFajrMode ? 'الفجر' : 'المغرب');
                isFajrMode = !isFajrMode; // تبديل الوضع بين الفجر والمغرب
                updateTimeDisplay(); // تحديث العرض بناءً على الوضع الجديد
                
                // إضافة تأثير مرئي عند تغيير العد التنازلي
                countdownDisplay.classList.add('highlight');
                setTimeout(() => {
                    countdownDisplay.classList.remove('highlight');
                }, 1000);
                
                return;
            }
            countdownDisplay.textContent = "00:00:00";
            return;
        }
        
        // Calculate hours, minutes, and seconds
        const hours = Math.floor(diff / (1000 * 60 * 60));
        diff -= hours * (1000 * 60 * 60);
        
        const minutes = Math.floor(diff / (1000 * 60));
        diff -= minutes * (1000 * 60);
        
        const seconds = Math.floor(diff / 1000);
        
        // تنسيق نص العد التنازلي
        const countdownText = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        
        // حساب الوقت الكلي بالثواني
        const totalTimeInSeconds = getTimeDifferenceInSeconds();
        const remainingTimeInSeconds = hours * 3600 + minutes * 60 + seconds;
        
        // تنفيذ تأثير التعبئة
        updateCountdownFill(countdownText, remainingTimeInSeconds, totalTimeInSeconds);
    }
    
    // وظيفة جديدة لحساب الوقت الكلي المتبقي للعد التنازلي في بداية العد
    function getTimeDifferenceInSeconds() {
        // في حالة الفجر، غالبًا ما تكون المدة حوالي 8 ساعات أو 28800 ثانية
        // في حالة المغرب، غالبًا ما تكون المدة حوالي 14 ساعة أو 50400 ثانية
        // هذه هي القيم الافتراضية إذا لم نتمكن من حساب القيمة الدقيقة
        const defaultTimerLength = isFajrMode ? 28800 : 50400;
        
        // في الوضع المثالي، يمكننا حساب الفرق بين الوقت الحالي والوقت المستهدف
        if (targetTime) {
            const now = new Date();
            const diffMs = targetTime - now;
            return Math.max(Math.floor(diffMs / 1000), 0);
        }
        
        return defaultTimerLength;
    }
    
    // وظيفة جديدة لتحديث تأثير تعبئة العد التنازلي
    function updateCountdownFill(countdownText, remainingTimeInSeconds, totalTimeInSeconds) {
        // إزالة أي عناصر سابقة للعد التنازلي
        while (countdownDisplay.firstChild) {
            countdownDisplay.removeChild(countdownDisplay.firstChild);
        }
        
        // إنشاء عنصر جديد لتأثير التعبئة
        const fillElement = document.createElement('span');
        fillElement.className = 'countdown-fill';
        fillElement.setAttribute('data-text', countdownText);
        fillElement.textContent = countdownText;
        
        // حساب نسبة مئوية للتقدم
        let progressPercent = 0;
        if (totalTimeInSeconds > 0) {
            progressPercent = 100 - ((remainingTimeInSeconds / totalTimeInSeconds) * 100);
        }
        
        // تطبيق مستويات التعبئة المختلفة
        if (progressPercent >= 80) {
            fillElement.classList.add('level-5');
        } else if (progressPercent >= 60) {
            fillElement.classList.add('level-4');
        } else if (progressPercent >= 40) {
            fillElement.classList.add('level-3');
        } else if (progressPercent >= 20) {
            fillElement.classList.add('level-2');
        } else if (progressPercent > 0) {
            fillElement.classList.add('level-1');
        } else {
            fillElement.classList.add('level-0');
        }
        
        // إذا كان العد التنازلي قريبًا من الصفر (أقل من 5 دقائق)
        if (remainingTimeInSeconds < 300) {
            fillElement.classList.add('near-end');
        }
        
        // إضافة العنصر إلى العرض
        countdownDisplay.appendChild(fillElement);
    }
    
    // عرض إشعار
    function showNotification(message) {
        notificationElement.textContent = message;
        notificationElement.style.display = 'block';
        
        setTimeout(() => {
            notificationElement.style.display = 'none';
        }, 10000);
    }
    
    // معالجة تغيير اختيار الموقع
    locationSelect.addEventListener('change', function() {
        currentCity = this.value;
        updatePrayerTimes();
        updateCountdown();
    });
    
    // تهيئة الوضع الداكن
    function initDarkMode() {
        // التحقق من وجود إعداد محفوظ
        const savedDarkMode = localStorage.getItem('darkMode');
        
        if (savedDarkMode === 'true') {
            document.documentElement.classList.add('dark-mode');
            darkModeToggle.checked = true;
        }
        
        // إضافة مستمع حدث لزر التبديل
        darkModeToggle.addEventListener('change', function() {
            if (this.checked) {
                document.documentElement.classList.add('dark-mode');
                localStorage.setItem('darkMode', 'true');
            } else {
                document.documentElement.classList.remove('dark-mode');
                localStorage.setItem('darkMode', 'false');
            }
        });
    }
    
    // تهيئة وضع العمل (الفجر أو المغرب) بناءً على الوقت الحالي
    function initializeMode() {
        if (!fajrTime || !maghribTime) {
            console.error('لم يتم تحميل أوقات الصلاة بعد!');
            return;
        }
        
        const now = new Date();
        
        // تحويل وقت الفجر والمغرب إلى كائن Date
        const fajrDate = timeStringToDate(fajrTime, now);
        const maghribDate = timeStringToDate(maghribTime, now);
        
        // طباعة معلومات للتصحيح
        console.log('الوقت الحالي:', now);
        console.log('وقت الفجر:', fajrDate);
        console.log('وقت المغرب:', maghribDate);
        
        // استخدام منطق أكثر تعقيدًا لتحديد الوضع
        // بناءً على مقارنة مباشرة للأوقات
        const currentHour = now.getHours();
        const currentMinute = now.getMinutes();
        
        // حساب الوقت بالدقائق منذ منتصف الليل
        const nowMinutes = currentHour * 60 + currentMinute;
        const fajrMinutes = fajrDate.getHours() * 60 + fajrDate.getMinutes();
        const maghribMinutes = maghribDate.getHours() * 60 + maghribDate.getMinutes();
        
        // إذا كان الوقت الحالي بين منتصف الليل والفجر أو بين المغرب ومنتصف الليل
        // فنحن نعرض وقت الفجر، وإلا نعرض وقت المغرب
        
        if (nowMinutes < fajrMinutes || nowMinutes > maghribMinutes) {
            isFajrMode = true;
        } else {
            isFajrMode = false;
        }
        
        // إضافة معلومات التصحيح
        console.log('تهيئة الوضع:', isFajrMode ? 'الفجر' : 'المغرب');
        console.log('الوقت الحالي بالدقائق:', nowMinutes);
        console.log('وقت الفجر بالدقائق:', fajrMinutes);
        console.log('وقت المغرب بالدقائق:', maghribMinutes);
        
        updateDebugInfo(`الوضع: ${isFajrMode ? 'الفجر' : 'المغرب'} | الوقت: ${now.toLocaleTimeString('ar')}`);
        
        // تحديث العرض بناءً على الوضع المحدد
        updateTimeDisplay();
    }
    
    // تحميل مواقيت الصلاة
    loadPrayerTimes();
    
    // تحديث العد التنازلي كل ثانية
    setInterval(updateCountdown, 1000);
    
    // تحديث التاريخ مرة واحدة
    updateDate();
    
    // تهيئة الوضع الداكن
    initDarkMode();
    
    // تحديث العنوان بناءً على المدينة الافتراضية
    updateTitleByLocation(currentCity);
});