import os
import uuid
import fitz  # PyMuPDF
from ebooklib import epub
from PIL import Image
from io import BytesIO
from typing import Tuple, Optional


class PDFToEPUBConverter:
    def __init__(self, pdf_path: str, output_dir: str):
        self.pdf_path = pdf_path
        self.output_dir = output_dir
        self.book = None

    def convert(
        self, title: str = "Untitled", author: str = "Unknown"
    ) -> Tuple[bool, str, Optional[str]]:
        try:
            doc = fitz.open(self.pdf_path)

            self.book = epub.EpubBook()
            self.book.set_identifier(f"ebook-{uuid.uuid4()}")
            self.book.set_title(title)
            self.book.add_author(author)

            chapters = []
            chapter_content = ""
            chapter_count = 0

            for page_num in range(len(doc)):
                page = doc[page_num]
                text = page.get_text()

                if text.strip():
                    chapter_content += f"<p>{text}</p>\n"

                    if self._is_new_chapter(text) or page_num == len(doc) - 1:
                        if chapter_content.strip():
                            chapter = epub.EpubHtml(
                                title=f"Chapter {chapter_count + 1}",
                                file_name=f"chapter_{chapter_count + 1}.xhtml",
                                lang="en",
                            )
                            chapter.content = chapter_content
                            self.book.add_item(chapter)
                            chapters.append(chapter)
                            chapter_content = ""
                            chapter_count += 1

            if not chapters:
                chapter = epub.EpubHtml(
                    title="Content", file_name="content.xhtml", lang="en"
                )
                chapter.content = (
                    chapter_content or "<p>No text content found in PDF.</p>"
                )
                self.book.add_item(chapter)
                chapters.append(chapter)

            self.book.toc = tuple(chapters)
            self.book.add_item(epub.EpubNcx())
            self.book.add_item(epub.EpubNav())

            style = """
            body { font-family: Arial, sans-serif; margin: 1em; }
            p { text-indent: 1em; margin-bottom: 0.5em; }
            """
            nav_css = epub.EpubItem(
                uid="style_nav",
                file_name="style/nav.css",
                media_type="text/css",
                content=style,
            )
            self.book.add_item(nav_css)

            output_filename = f"{uuid.uuid4()}.epub"
            output_path = os.path.join(self.output_dir, output_filename)

            epub.write_epub(output_path, self.book, {})
            doc.close()

            return True, "Conversion successful", output_filename

        except Exception as e:
            return False, f"Conversion failed: {str(e)}", None

    def _is_new_chapter(self, text: str) -> bool:
        text = text.strip().lower()
        chapter_indicators = [
            "chapter",
            "section",
            "part",
            "introduction",
            "conclusion",
        ]
        if len(text) < 100 and any(
            indicator in text for indicator in chapter_indicators
        ):
            return True
        if text.startswith("chapter") and len(text) < 50:
            return True
        return False


def convert_pdf_to_epub(
    pdf_path: str, output_dir: str, title: str = "Untitled", author: str = "Unknown"
) -> Tuple[bool, str, Optional[str]]:
    converter = PDFToEPUBConverter(pdf_path, output_dir)
    return converter.convert(title, author)
