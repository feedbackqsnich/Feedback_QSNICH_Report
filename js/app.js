
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

// ========================================
// FEEDBACK LIST STATE
// ========================================

let feedbackCategoryFilter = "all";
let feedbackSearchQuery = "";
let feedbackDepartmentFilter = "all";

let currentFeedbackPage = 1;
const FEEDBACK_PER_PAGE = 10;

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
    const feedbackList = document.getElementById("feedbackPreviewList");

    if (feedbackList) {
        feedbackList.innerHTML = `
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

// ========================================
// เริ่มต้น Dashboard
// ========================================

async function init() {
    try {
        setDashboardLoading();

        feedbackData = await getFeedbackData();

        console.log("ข้อมูลจาก Google Sheets:", feedbackData);

        const fiscalYearFilter = document.getElementById("fiscalYearFilter");

        // อ่านปีงบประมาณที่จำไว้
        const cachedYear = getCachedFiscalYear();

        if (
            fiscalYearFilter &&
            fiscalYearFilter.querySelector(`option[value="${cachedYear}"]`)
        ) {
            fiscalYearFilter.value = cachedYear;
        }

        // สร้างรายการหน่วยงานใน Dropdown
        populateDepartmentFilter(feedbackData);

        // ตั้งค่าตัวกรองประเภทความคิดเห็น
        setupFeedbackCategoryFilter();

        // ตั้งค่าค้นหา
        setupFeedbackSearch();

        // ตั้งค่าตัวกรองหน่วยงาน
        setupFeedbackDepartmentFilter();

        // แสดง Dashboard
        updateDashboard(cachedYear);

        // ฟังการเปลี่ยนปีงบประมาณ
        if (fiscalYearFilter) {
            fiscalYearFilter.addEventListener("change", (event) => {
                const selectedYear = event.target.value;

                saveCachedFiscalYear(selectedYear);

                currentFeedbackPage = 1;
                updateDashboard(selectedYear);
            });
        }

    } catch (error) {
        console.error("เกิดข้อผิดพลาด:", error);

        const container = document.getElementById("feedbackPreviewList");

        if (container) {
            container.innerHTML = `
                <div class="feedback-empty">
                    ไม่สามารถโหลดข้อมูลความคิดเห็นได้ กรุณาลองใหม่อีกครั้ง
                </div>
            `;
        }

    } finally {
        removeDashboardLoading();
    }
}

// ========================================
// DEPARTMENT FILTER
// ========================================

function populateDepartmentFilter(data) {
    const select = document.getElementById("feedbackDepartmentFilter");

    if (!select) return;

    const departments = [...new Set(
        (data || [])
            .map(item => String(item.Department || "").trim())
            .filter(Boolean)
    )].sort((a, b) => a.localeCompare(b, "th"));

    select.innerHTML = `
        <option value="all">ทุกหน่วยงาน</option>
        ${departments.map(department => `
            <option value="${escapeFeedbackHtml(department)}">
                ${escapeFeedbackHtml(department)}
            </option>
        `).join("")}
    `;
}

// ========================================
// FEEDBACK SEARCH
// ========================================

function setupFeedbackSearch() {
    const searchInput = document.getElementById("feedbackSearch");

    if (!searchInput) return;

    searchInput.addEventListener("input", () => {
        feedbackSearchQuery = searchInput.value.trim().toLowerCase();
        currentFeedbackPage = 1;

        const fiscalYearFilter = document.getElementById("fiscalYearFilter");
        const selectedYear = fiscalYearFilter
            ? fiscalYearFilter.value
            : "all";

        renderFeedbackPreview(
            feedbackData,
            selectedYear,
            feedbackCategoryFilter
        );
    });
}

// ========================================
// FEEDBACK CATEGORY FILTER
// ========================================

function setupFeedbackCategoryFilter() {
    const filterButtons = document.querySelectorAll(
        ".feedback-filter-btn"
    );

    filterButtons.forEach(filterButton => {
        filterButton.addEventListener("click", () => {
            feedbackCategoryFilter = filterButton.dataset.category || "all";
            currentFeedbackPage = 1;

            filterButtons.forEach(btn => {
                const isActive = btn === filterButton;

                btn.classList.toggle("active", isActive);
                btn.setAttribute(
                    "aria-pressed",
                    isActive ? "true" : "false"
                );
            });

            const fiscalYearFilter = document.getElementById("fiscalYearFilter");
            const selectedYear = fiscalYearFilter
                ? fiscalYearFilter.value
                : "all";

            renderFeedbackPreview(
                feedbackData,
                selectedYear,
                feedbackCategoryFilter
            );
        });
    });
}

function setupFeedbackDepartmentFilter() {
    const select = document.getElementById("feedbackDepartmentFilter");

    if (!select) return;

    select.addEventListener("change", () => {
        feedbackDepartmentFilter = select.value || "all";
        currentFeedbackPage = 1;

        const fiscalYearFilter = document.getElementById("fiscalYearFilter");
        const selectedYear = fiscalYearFilter
            ? fiscalYearFilter.value
            : "all";

        renderFeedbackPreview(
            feedbackData,
            selectedYear,
            feedbackCategoryFilter
        );
    });
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
        feedbackCategoryFilter
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

// ========================================
// RENDER FEEDBACK LIST + PAGINATION
// ========================================

function renderFeedbackPreview(data, fiscalYear = "all", category = "all") {
    const container = document.getElementById("feedbackPreviewList");
    const pagination = document.getElementById("feedbackPagination");
    const resultsInfo = document.getElementById("feedbackResultsInfo");

    if (!container) return;

    // 1. กรองปีงบประมาณ
    let filtered = filterByFiscalYear(data || [], fiscalYear);

    // 2. กรองประเภทความคิดเห็น
    if (category !== "all") {
        const targetCategory = getFeedbackCategoryLabel(category);

        filtered = filtered.filter(item =>
            getFeedbackCategoryLabel(item.Category) === targetCategory
        );
    }

    // 3. กรองหน่วยงาน
    if (feedbackDepartmentFilter !== "all") {
        filtered = filtered.filter(item =>
            String(item.Department || "").trim() === feedbackDepartmentFilter
        );
    }

    // 4. ค้นหา
    if (feedbackSearchQuery) {
        filtered = filtered.filter(item => {
            const searchableText = [
                item.Detail,
                item.Department,
                item.Building,
                item.Floor,
                getFeedbackCategoryLabel(item.Category),
                item.Timestamp
            ]
                .map(value => String(value || ""))
                .join(" ")
                .toLowerCase();

            return searchableText.includes(feedbackSearchQuery);
        });
    }

    // 5. เรียงวันที่ล่าสุดก่อน
    // วันที่ผิดหรือไม่มีวันที่จะอยู่ท้ายรายการ
    filtered.sort((a, b) => {
        const dateA = a.Timestamp ? new Date(a.Timestamp).getTime() : NaN;
        const dateB = b.Timestamp ? new Date(b.Timestamp).getTime() : NaN;

        const validA = Number.isFinite(dateA);
        const validB = Number.isFinite(dateB);

        if (validA && validB) return dateB - dateA;
        if (validA) return -1;
        if (validB) return 1;

        return 0;
    });

    // 6. Pagination
    const totalItems = filtered.length;
    const totalPages = Math.ceil(totalItems / FEEDBACK_PER_PAGE);

    currentFeedbackPage = totalPages === 0
        ? 1
        : Math.min(Math.max(currentFeedbackPage, 1), totalPages);

    const startIndex = (currentFeedbackPage - 1) * FEEDBACK_PER_PAGE;
    const endIndex = Math.min(startIndex + FEEDBACK_PER_PAGE, totalItems);

    const pageItems = filtered.slice(startIndex, endIndex);

    // 7. แสดงจำนวนรายการ
    if (resultsInfo) {
        resultsInfo.textContent = totalItems > 0
            ? `พบ ${totalItems.toLocaleString("th-TH")} รายการ · หน้า ${currentFeedbackPage.toLocaleString("th-TH")} จาก ${totalPages.toLocaleString("th-TH")}`
            : "ไม่พบความคิดเห็น";
    }

    // 8. กรณีไม่มีข้อมูล
    if (!pageItems.length) {
        container.innerHTML = `
            <div class="feedback-empty">
                ไม่พบความคิดเห็น
            </div>
        `;

        if (pagination) pagination.innerHTML = "";
        return;
    }

    // 9. Render รายการความคิดเห็น
    container.innerHTML = pageItems.map(item => {
        const label = getFeedbackCategoryLabel(item.Category);
        const dateTime = formatFeedbackDateTime(item.Timestamp);

        const department = String(
            item.Department || "ไม่ระบุหน่วยงาน"
        ).trim();

        const building = String(item.Building || "").trim();
        const floor = String(item.Floor || "").trim();

        // ซ่อนสถานที่กรณีลานจอดรถ
        const isParking =
            /ลานจอดรถ/.test(department) ||
            /ลานจอดรถ/.test(building);

        let locationLine = "";

        if (!isParking) {
            const locationParts = [];

            if (floor) locationParts.push(`ชั้น ${floor}`);
            if (building) locationParts.push(building);

            locationLine = locationParts.join(" ") || "ไม่ระบุสถานที่";
        }

        // แสดงข้อความเต็ม
        const detail = String(item.Detail || "ไม่มีรายละเอียด")
            .replace(/\r\n/g, "\n")
            .replace(/\r/g, "\n")
            .replace(/\\n/g, "\n")
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

                <div class="feedback-detail-preview">
                    ${escapeFeedbackHtml(detail)}
                </div>

            </article>
        `;
    }).join("");

    // 10. สร้าง Pagination
    renderFeedbackPagination(
        totalPages,
        startIndex,
        endIndex,
        totalItems
    );
}

// ========================================
// FEEDBACK PAGINATION
// ========================================

function renderFeedbackPagination(
    totalPages,
    startIndex,
    endIndex,
    totalItems
) {
    const container = document.getElementById("feedbackPagination");

    if (!container) return;

    if (totalPages <= 1) {
        container.innerHTML = "";
        return;
    }

    // สร้างชุดเลขหน้าที่ต้องแสดง
    let pages = [];

    if (totalPages <= 7) {
        pages = Array.from(
            { length: totalPages },
            (_, i) => i + 1
        );
    } else {
        const pageSet = new Set([
            1,
            totalPages,
            currentFeedbackPage,
            currentFeedbackPage - 1,
            currentFeedbackPage + 1,
            currentFeedbackPage - 2,
            currentFeedbackPage + 2
        ]);

        pages = [...pageSet]
            .filter(page => page >= 1 && page <= totalPages)
            .sort((a, b) => a - b);
    }

    // เพิ่ม ... เมื่อมีช่วงเลขหน้าขาด
    const pageItems = [];

    for (let i = 0; i < pages.length; i++) {
        if (i > 0 && pages[i] - pages[i - 1] > 1) {
            pageItems.push("ellipsis");
        }

        pageItems.push(pages[i]);
    }

    // ปุ่มก่อนหน้า
    let html = `
        <button
            type="button"
            data-page="${currentFeedbackPage - 1}"
            aria-label="หน้าก่อนหน้า"
            ${currentFeedbackPage === 1 ? "disabled" : ""}
        >
            ‹
        </button>
    `;

    // ปุ่มเลขหน้า
    pageItems.forEach(page => {
        if (page === "ellipsis") {
            html += `
                <span class="pagination-ellipsis" aria-hidden="true">
                    …
                </span>
            `;
        } else {
            html += `
                <button
                    type="button"
                    data-page="${page}"
                    class="${page === currentFeedbackPage ? "active" : ""}"
                    ${page === currentFeedbackPage ? 'aria-current="page"' : ""}
                >
                    ${page.toLocaleString("th-TH")}
                </button>
            `;
        }
    });

    // ปุ่มถัดไป
    html += `
        <button
            type="button"
            data-page="${currentFeedbackPage + 1}"
            aria-label="หน้าถัดไป"
            ${currentFeedbackPage === totalPages ? "disabled" : ""}
        >
            ›
        </button>
    `;

    container.innerHTML = html;

    // Event เปลี่ยนหน้า
    container.onclick = event => {
        const button = event.target.closest("button[data-page]");

        if (!button || button.disabled) return;

        const targetPage = Number(button.dataset.page);

        if (
            !Number.isInteger(targetPage) ||
            targetPage < 1 ||
            targetPage > totalPages ||
            targetPage === currentFeedbackPage
        ) {
            return;
        }

        currentFeedbackPage = targetPage;

        const fiscalYearFilter = document.getElementById("fiscalYearFilter");
        const selectedYear = fiscalYearFilter
            ? fiscalYearFilter.value
            : "all";

        renderFeedbackPreview(
            feedbackData,
            selectedYear,
            feedbackCategoryFilter
        );

        // เลื่อนเฉพาะไปยังหัวข้อความคิดเห็น
        const feedbackSection = document.getElementById("feedback-section");

        if (feedbackSection) {
            feedbackSection.scrollIntoView({
                behavior: "smooth",
                block: "start"
            });
        }
    };
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
