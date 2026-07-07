package io.github.lucasfle.palantirworker;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.palantir.javaformat.java.FormatterException;
import org.junit.jupiter.api.Test;

class PalantirFormatterTest {
    private final PalantirFormatter formatter = new PalantirFormatter();

    @Test
    void formatsAndIndentsSource() throws FormatterException {
        assertEquals(
                "class Example {\n"
                        + "    void run() {\n"
                        + "        System.out.println(\"ok\");\n"
                        + "    }\n"
                        + "}\n",
                formatter.format("class Example{void run(){System.out.println(\"ok\");}}"));
    }

    @Test
    void sortsImportsAndRemovesUnusedImports() throws FormatterException {
        String source = """
                import java.util.Set;
                import java.util.ArrayList;
                import java.util.List;
                class Example { List<String> values = new ArrayList<>(); }
                """;
        String formatted = formatter.format(source);
        assertTrue(formatted.indexOf("import java.util.ArrayList;") < formatted.indexOf("import java.util.List;"));
        assertFalse(formatted.contains("java.util.Set"));
    }

    @Test
    void reflowsLongStrings() throws FormatterException {
        String source = """
                class Example {
                  String value = "This is a deliberately very long string which should be reflowed by Palantir Java Format because it exceeds the configured line width by a substantial amount.";
                }
                """;
        String formatted = formatter.format(source);
        assertTrue(formatted.contains("+ \""));
        assertTrue(formatted.lines().allMatch(line -> line.length() <= 120));
    }

    @Test
    void acceptsUnicode() throws FormatterException {
        String formatted = formatter.format("class Café{String message=\"你好 🌍\";}");
        assertTrue(formatted.contains("class Café"));
        assertTrue(formatted.contains("\"你好 🌍\""));
    }

    @Test
    void rejectsInvalidJava() {
        assertThrows(FormatterException.class, () -> formatter.format("class {"));
    }

    @Test
    void preservesCrLfAndFinalNewline() throws FormatterException {
        String formatted = formatter.format("class Example {\r\n}\r\n");
        assertEquals("class Example {}\r\n", formatted);
        assertTrue(formatted.endsWith("\r\n"));
    }

    @Test
    void addsFinalNewlineWhenAbsent() throws FormatterException {
        assertEquals("class Example {}\n", formatter.format("class Example {}"));
    }
}
