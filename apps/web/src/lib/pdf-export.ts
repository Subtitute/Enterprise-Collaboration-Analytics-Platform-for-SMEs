import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';

// 23/09/2026: tinh nang "Xuat PDF" truoc day chi goi window.print() (mo hop thoai in cua trinh
// duyet ngay lap tuc, nguoi dung phai tu chon "Save as PDF") - khong that su tao ra 1 file .pdf.
// Ham nay chup lai 1 phan tu DOM (html2canvas) roi ghep vao 1 file PDF that su (jsPDF), tai xuong
// truc tiep - "In" (window.print(), giu nguyen o DashboardPage.tsx) chi con la lua chon THU HAI.
export async function exportElementToPdf(element: HTMLElement, filename: string): Promise<void> {
  const canvas = await html2canvas(element, {
    // 23/09/2026: giam tu 2 xuong 1.5 + doi PNG (khong nen) sang JPEG chat luong 0.92 ben duoi -
    // ban dau (scale 2 + PNG) cho ra file ~19MB cho 1 Dashboard binh thuong (qua nang de tai
    // xuong/gui email), trong khi 1.5 + JPEG van du net de doc bieu do/chu, giam con vai MB.
    scale: 1.5,
    backgroundColor: '#ffffff',
    useCORS: true,
    // Bo qua cac phan tu chi danh cho man hinh (nut bam, link "Xem tat ca"...) - cung class
    // ".no-print" da dung cho @media print hien co, tai su dung thay vi dinh nghia rieng.
    ignoreElements: (el) => el.classList.contains('no-print'),
  });

  const imgData = canvas.toDataURL('image/jpeg', 0.92);
  const pdf = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' });
  const pageWidthMm = pdf.internal.pageSize.getWidth();
  const pageHeightMm = pdf.internal.pageSize.getHeight();

  const imgWidthMm = pageWidthMm;
  const imgHeightMm = (canvas.height * imgWidthMm) / canvas.width;

  // Anh cao hon 1 trang A4 -> cat thanh nhieu trang, moi trang dich chuyen phan anh len tren bang
  // chieu cao 1 trang (ky thuat pagination chuan cho jsPDF+html2canvas).
  let renderedHeightMm = 0;
  let pageIndex = 0;
  while (renderedHeightMm < imgHeightMm) {
    if (pageIndex > 0) pdf.addPage();
    pdf.addImage(imgData, 'JPEG', 0, -renderedHeightMm, imgWidthMm, imgHeightMm);
    renderedHeightMm += pageHeightMm;
    pageIndex += 1;
  }

  pdf.save(`${filename}.pdf`);
}
