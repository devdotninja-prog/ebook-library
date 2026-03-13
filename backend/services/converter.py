import os
import uuid
import re
import fitz
from ebooklib import epub
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
            self.book.set_identifier(f"urn:uuid:{uuid.uuid4()}")
            self.book.set_title(title)
            self.book.add_author(author or "Unknown")
            self.book.language = "en"

            all_text = []
            for page in doc:
                text = page.get_text("text")
                if text and text.strip():
                    all_text.append(text.strip())

            doc.close()

            if not all_text:
                return (
                    False,
                    "No text content found in PDF. This may be a scanned/image-based PDF.",
                    None,
                )

            chapters = []
            for i, section_text in enumerate(all_text):
                chapter_name = f"Chapter {i + 1}"
                chapter = epub.EpubHtml(
                    title=chapter_name, file_name=f"chapter{i + 1}.xhtml", lang="en"
                )
                chapter.content = f"<h1>{chapter_name}</h1><p>{section_text}</p>"
                self.book.add_item(chapter)
                chapters.append(chapter)

            self.book.toc = tuple(chapters)
            self.book.add_item(epub.EpubNcx())
            self.book.add_item(epub.EpubNav())

            style = """body {
    font-family: Georgia, serif;
    font-size: 1em;
    line-height: 1.6;
    margin: 1.5em;
    color: #333;
}
h1 {
    font-size: 1.5em;
    text-align: center;
    margin-bottom: 1em;
    color: #1a1a1a;
}
p {
    text-indent: 1.5em;
    margin-bottom: 0.8em;
    text-align: justify;
}"""

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

            return True, "Conversion successful", output_filename

        except Exception as e:
            import traceback

            return False, f"Conversion failed: {str(e)}\n{traceback.format_exc()}", None


def convert_pdf_to_epub(
    pdf_path: str, output_dir: str, title: str = "Untitled", author: str = "Unknown"
) -> Tuple[bool, str, Optional[str]]:
    converter = PDFToEPUBConverter(pdf_path, output_dir)
    return converter.convert(title, author)
