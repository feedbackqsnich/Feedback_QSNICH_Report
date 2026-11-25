
// ==============================
// วันที่และเวลา Real-time (เวลาไทย)
// ==============================

function updateRealTime() {
    const now = new Date();

    const dateElement = document.getElementById("lastUpdateDate");
    const timeElement = document.getElementById("lastUpdateTime");

    const thaiDate = new Intl.DateTimeFormat("th-TH", {
        day: "numeric",
        month: "long",
        year: "numeric",
        timeZone: "Asia/Bangkok"
    }).format(now);

    const thaiTime = new Intl.DateTimeFormat("th-TH", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false,
        timeZone: "Asia/Bangkok"
    }).format(now);

    if (dateElement) dateElement.textContent = thaiDate;
    if (timeElement) timeElement.textContent = `${thaiTime} น.`;
}

document.addEventListener("DOMContentLoaded", () => {
    updateRealTime();
    setInterval(updateRealTime, 20000);
    init();
});

let feedbackData = [];

// ==============================
// CACHE ปีงบประมาณ
// ==============================

const FISCAL_YEAR_CACHE_KEY = "selectedFiscalYear";

function getCachedFiscalYear() {
    return localStorage.getItem(FISCAL_YEAR_CACHE_KEY) || "all";
}

function saveCachedFiscalYear(year) {
    localStorage.setItem(FISCAL_YEAR_CACHE_KEY, year);
}
let previewCategoryFilter = "all";

// ========================================
// COUNT-UP ANIMATION
// ========================================

function animateCount(element, targetValue, duration = 700) {
    if (!element) return;

    const target = Number(targetValue) || 0;
    const startTime = performance.now();

    // ป้องกัน Animation ซ้อนกัน
    if (element._countAnimationFrame) {
        cancelAnimationFrame(element._countAnimationFrame);
    }

    function update(currentTime) {
        const progress = Math.min(
            (currentTime - startTime) / duration,
            1
        );

        // Ease-out ให้เริ่มเร็วแล้วค่อย ๆ ช้าลง
        const eased = 1 - Math.pow(1 - progress, 3);

        const currentValue = Math.round(target * eased);

        element.textContent = currentValue.toLocaleString("th-TH");

        if (progress < 1) {
            element._countAnimationFrame =
                requestAnimationFrame(update);
        } else {
            element.textContent = target.toLocaleString("th-TH");
            element._countAnimationFrame = null;
        }
    }

    element._countAnimationFrame = requestAnimationFrame(update);
}

// ==============================
// DASHBOARD LOADING
// ==============================

function setDashboardLoading() {

    // Loading ในตัวเลขสรุป
    const summaryValues = document.querySelectorAll(
        ".summary-card .summary-value"
    );

    summaryValues.forEach(element => {
        element.innerHTML = `
            <span class="loading-spinner"></span>
        `;
    });


    // Loading ในรายการความคิดเห็นล่าสุด
    const preview = document.getElementById("feedbackPreviewList");

    if (preview) {
        preview.innerHTML = `
            <div class="dashboard-loading">
                <span class="loading-spinner"></span>
                <span>กำลังโหลดความคิดเห็น...</span>
            </div>
        `;
    }


    // Loading ในพื้นที่กราฟ
    document.querySelectorAll(".chart-wrapper").forEach(wrapper => {

        // ป้องกัน Loading ซ้ำ
        if (wrapper.querySelector(".chart-loading")) return;

        wrapper.style.position = "relative";

        const loading = document.createElement("div");
        loading.className = "dashboard-loading chart-loading";

        loading.innerHTML = `
            <span class="loading-spinner"></span>
            <span>กำลังโหลดกราฟ...</span>
        `;

        wrapper.appendChild(loading);

    });

}


// ==============================
// REMOVE DASHBOARD LOADING
// ==============================

function removeDashboardLoading() {

    // เอาตัว Loading ออกจากพื้นที่กราฟทั้งหมด
    document.querySelectorAll(".chart-loading").forEach(loading => {
        loading.remove();
    });

}

// ==============================
// เริ่มต้น Dashboard
// ==============================

async function init() {
    try {

        // แสดง Loading ทุกช่องและกราฟ
        setDashboardLoading();

        feedbackData = await getFeedbackData();

        console.log("ข้อมูลจาก Google Sheets:", feedbackData);

        const fiscalYearFilter = document.getElementById("fiscalYearFilter");

        // เชื่อมปุ่มดูเพิ่มเติมกับ Filter ปัจจุบัน
        const viewAllFeedbackBtn = document.getElementById("viewAllFeedbackBtn");

        if (viewAllFeedbackBtn) {
            viewAllFeedbackBtn.addEventListener("click", () => {

                const selectedYear = fiscalYearFilter
                    ? fiscalYearFilter.value
                    : "all";

                const params = new URLSearchParams();

                params.set("year", selectedYear);
                params.set("category", previewCategoryFilter);

                viewAllFeedbackBtn.href = `feedback.html?${params.toString()}`;
            });
        }

        // อ่านปีงบประมาณที่จำไว้
        const cachedYear = getCachedFiscalYear();

        if (
            fiscalYearFilter &&
            fiscalYearFilter.querySelector(`option[value="${cachedYear}"]`)
        ) {
            fiscalYearFilter.value = cachedYear;
        }

        // แสดง Dashboard ตามปีงบประมาณที่บันทึกไว้
        updateDashboard(cachedYear);

        // ฟังการเปลี่ยนปีงบประมาณ + บันทึก Cache
        if (fiscalYearFilter) {
            fiscalYearFilter.addEventListener("change", (event) => {
                const selectedYear = event.target.value;

                saveCachedFiscalYear(selectedYear);
                updateDashboard(selectedYear);
            });
        }

        // ปุ่มกรองประเภทความคิดเห็น
        const previewFilterButtons = document.querySelectorAll(".feedback-filter-btn");

        previewFilterButtons.forEach(button => {
            button.addEventListener("click", () => {
                previewCategoryFilter = button.dataset.category || "all";

                previewFilterButtons.forEach(btn => {
                    const active = btn === button;

                    btn.classList.toggle("active", active);
                    btn.setAttribute("aria-pressed", active ? "true" : "false");
                });

                const selectedYear = fiscalYearFilter
                    ? fiscalYearFilter.value
                    : "all";

                renderFeedbackPreview(
                    feedbackData,
                    selectedYear,
                    previewCategoryFilter
                );
            });
        });

    } catch (error) {

        console.error("เกิดข้อผิดพลาด:", error);

    } finally {

        // เอาตัวบังกราฟออกหลังโหลดเสร็จ
        removeDashboardLoading();

    }
}

// ==============================
// คืนค่าปีงบประมาณเมื่อ Browser กลับมาหน้า Dashboard
// ==============================

window.addEventListener("pageshow", (event) => {
    // ทำงานเฉพาะกรณี Browser คืนหน้าจอจาก Back/Forward Cache
    if (!event.persisted) return;

    const fiscalYearFilter = document.getElementById("fiscalYearFilter");
    if (!fiscalYearFilter) return;

    const cachedYear = getCachedFiscalYear();

    if (
        fiscalYearFilter.querySelector(`option[value="${cachedYear}"]`)
    ) {
        fiscalYearFilter.value = cachedYear;
        updateDashboard(cachedYear);
    }
});

// ==============================
// กรองข้อมูลตามปีงบประมาณ
// ==============================

function filterByFiscalYear(data, fiscalYear) {
    if (fiscalYear === "all") return data;

    return data.filter(item => {
        if (!item.Timestamp) return false;

        const date = new Date(item.Timestamp);
        if (isNaN(date.getTime())) return false;

        // อ่านปีและเดือนตามเวลาไทย
        const parts = new Intl.DateTimeFormat("en-US", {
            year: "numeric",
            month: "numeric",
            timeZone: "Asia/Bangkok"
        }).formatToParts(date);

        const year = Number(
            parts.find(part => part.type === "year")?.value
        );

        const month = Number(
            parts.find(part => part.type === "month")?.value
        );

        // ปีงบประมาณเริ่มเดือนตุลาคม
        const thaiFiscalYear = month >= 10
            ? year + 544
            : year + 543;

        return thaiFiscalYear === Number(fiscalYear);
    });
}

// ==============================
// อัปเดต Dashboard
// ==============================

function updateDashboard(fiscalYear) {

    const filteredData = filterByFiscalYear(feedbackData, fiscalYear);

    console.log("ปีงบประมาณที่เลือก:", fiscalYear);
    console.log("ข้อมูลหลังกรอง:", filteredData);

    // สรุปจำนวนความคิดเห็น
    const summary = {
        compliment: filteredData.filter(
            item => item.Category === "compliment"
        ).length,

        suggestion: filteredData.filter(
            item => item.Category === "suggestion"
        ).length,

        complaint: filteredData.filter(
            item => item.Category === "complaint"
        ).length
    };

    summary.total =
        summary.compliment +
        summary.suggestion +
        summary.complaint;

    // คำนวณเปอร์เซ็นต์
    const getPercent = value => {
        return summary.total === 0
            ? 0
            : ((value / summary.total) * 100).toFixed(1);
    };

    const totalMeta = document.getElementById("totalMeta");
    const complaintMeta = document.getElementById("complaintMeta");
    const suggestionMeta = document.getElementById("suggestionMeta");
    const complimentMeta = document.getElementById("complimentMeta");

    if (totalMeta) {
        totalMeta.textContent = "ทุกประเภทในช่วงเวลาที่เลือก";
    }

    if (complaintMeta) {
        complaintMeta.textContent = `${getPercent(summary.complaint)}% ของทั้งหมด`;
    }

    if (suggestionMeta) {
        suggestionMeta.textContent = `${getPercent(summary.suggestion)}% ของทั้งหมด`;
    }

    if (complimentMeta) {
        complimentMeta.textContent = `${getPercent(summary.compliment)}% ของทั้งหมด`;
    }

    // ==============================
    // อัปเดต Summary Cards
    // ==============================

    const complimentCard = document.querySelector(
        ".summary-card.compliment .summary-value"
    );

    const suggestionCard = document.querySelector(
        ".summary-card.suggestion .summary-value"
    );

    const complaintCard = document.querySelector(
        ".summary-card.complaint .summary-value"
    );

    const totalCard = document.querySelector(
        ".summary-card.total .summary-value"
    );

    // ========================================
    // COUNT-UP SUMMARY
    // ========================================

    animateCount(complimentCard, summary.compliment);
    animateCount(suggestionCard, summary.suggestion);
    animateCount(complaintCard, summary.complaint);
    animateCount(totalCard, summary.total);

    // ==============================
    // อัปเดต Legend
    // ==============================

    const legendCompliment = document.getElementById("legendCompliment");
    const legendSuggestion = document.getElementById("legendSuggestion");
    const legendComplaint = document.getElementById("legendComplaint");

    if (legendCompliment) legendCompliment.textContent = summary.compliment;
    if (legendSuggestion) legendSuggestion.textContent = summary.suggestion;
    if (legendComplaint) legendComplaint.textContent = summary.complaint;

    // ==============================
    // เตรียมข้อมูลกราฟ
    // ==============================

    prepareChartData(filteredData, fiscalYear);

    // ==============================
    // อัปเดตตัวเลขกลางกราฟ
    // ==============================

    const pieCenterValue = document.getElementById("pieCenterValue");

    if (pieCenterValue) {
        pieCenterValue.textContent = summary.total;
    }

    // ==============================
    // สร้าง / อัปเดตกราฟ
    // ==============================

    initCharts();

    // อัปเดตรายการความคิดเห็นตามปีงบประมาณที่เลือก
    // ใช้ feedbackData ทั้งหมด เพื่อให้กรองปีได้ในฟังก์ชัน Preview
    renderFeedbackPreview(
        feedbackData,
        fiscalYear,
        previewCategoryFilter
    );

    console.log("Dashboard และกราฟอัปเดตสำเร็จ");
}

// ==============================
// แสดงความคิดเห็นล่าสุด 10 รายการ
// พร้อมตัวกรองปีงบประมาณและประเภท
// ==============================

function escapeFeedbackHtml(value) {
    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

// ==============================
// แปลงชื่อประเภทความคิดเห็น
// ==============================

function getFeedbackCategoryLabel(category) {
    const value = String(category || "").trim().toLowerCase();

    if (value.includes("compliment") || value.includes("ชม")) {
        return "คำชม";
    }

    if (value.includes("suggestion") || value.includes("เสนอ")) {
        return "ข้อเสนอแนะ";
    }

    if (value.includes("complaint") || value.includes("ร้องเรียน")) {
        return "ข้อร้องเรียน";
    }

    return "ไม่ระบุประเภท";
}

// ==============================
// แปลงวันที่และเวลา
// ==============================

function formatFeedbackDateTime(timestamp) {
    if (!timestamp) return "-";

    const date = new Date(timestamp);

    if (isNaN(date.getTime())) {
        return escapeFeedbackHtml(timestamp);
    }

    const dateText = new Intl.DateTimeFormat("th-TH", {
        day: "numeric",
        month: "short",
        year: "numeric",
        timeZone: "Asia/Bangkok"
    }).format(date);

    const timeText = new Intl.DateTimeFormat("th-TH", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
        timeZone: "Asia/Bangkok"
    }).format(date);

    return `${dateText} ${timeText} น.`;
}

// ==============================
// แสดงรายการความคิดเห็นล่าสุด
// ==============================

function renderFeedbackPreview(data, fiscalYear = "all", category = "all") {
    const container = document.getElementById("feedbackPreviewList");

    if (!container) return;

    // กรองปีงบประมาณก่อน
    const fiscalFiltered = filterByFiscalYear(data || [], fiscalYear);

    // กรองประเภทความคิดเห็น
    const categoryFiltered = category === "all"
        ? fiscalFiltered
        : fiscalFiltered.filter(item =>
            getFeedbackCategoryLabel(item.Category) ===
            getFeedbackCategoryLabel(category)
        );

    // เรียงใหม่จากวันที่ล่าสุด และเอาเฉพาะ 10 รายการ
    const latestFeedback = [...categoryFiltered]
        .filter(item =>
            item.Timestamp &&
            !isNaN(new Date(item.Timestamp).getTime())
        )
        .sort((a, b) =>
            new Date(b.Timestamp) - new Date(a.Timestamp)
        )
        .slice(0, 10);

    // กรณีไม่มีข้อมูล
    if (!latestFeedback.length) {
        container.innerHTML = `
            <div class="feedback-empty">
                ไม่มีข้อมูลความคิดเห็นในตัวกรองนี้
            </div>
        `;
        return;
    }

    // สร้างการ์ดความคิดเห็น
    container.innerHTML = latestFeedback.map(item => {
        const label = getFeedbackCategoryLabel(item.Category);
        const dateTime = formatFeedbackDateTime(item.Timestamp);

        const department = String(
            item.Department || "ไม่ระบุหน่วยงาน"
        ).trim();

        const building = String(item.Building || "").trim();
        const floor = String(item.Floor || "").trim();

        // ตรวจสอบว่าเป็นลานจอดรถหรือไม่
        const isParking =
            /ลานจอดรถ/.test(department) ||
            /ลานจอดรถ/.test(building);

        let locationLine = "";

        if (isParking) {
            // ลานจอดรถไม่แสดงสถานที่หรือข้อมูลอาคารซ้ำ
            locationLine = "";
        } else {
            const locationParts = [];

            if (floor) {
                locationParts.push(`ชั้น ${floor}`);
            }

            if (building) {
                locationParts.push(building);
            }

            locationLine = locationParts.join(" ") || "ไม่ระบุสถานที่";
        }

        const detail = String(item.Detail || "ไม่มีรายละเอียด")
            .replace(/\r\n/g, " ")
            .replace(/\n/g, " ")
            .replace(/\r/g, " ")
            .replace(/\\n/g, " ")
            .replace(/\s+/g, " ")
            .trim();

        return `
        <article class="feedback-item">

            <div class="feedback-item-header">
                <span class="feedback-type ${getFeedbackTypeClass(item.Category)}">
                    ${escapeFeedbackHtml(label)}
                </span>

                <span class="feedback-date">
                    ${escapeFeedbackHtml(dateTime)}
                </span>
            </div>

            <div class="feedback-department">
                ${escapeFeedbackHtml(department)}
            </div>

            ${locationLine ? `
                <div class="feedback-location">
                    ${escapeFeedbackHtml(locationLine)}
                </div>
            ` : ""}

            <div class="feedback-detail-preview" title="${escapeFeedbackHtml(detail)}">${escapeFeedbackHtml(detail)}</div>

        </article>
    `;
    }).join("");
}

// ==============================
// แปลงประเภทเป็น CSS Class
// ==============================

function getFeedbackTypeClass(category) {
    const label = getFeedbackCategoryLabel(category);

    if (label === "คำชม") return "type-compliment";
    if (label === "ข้อเสนอแนะ") return "type-suggestion";
    if (label === "ข้อร้องเรียน") return "type-complaint";

    return "type-other";
}
