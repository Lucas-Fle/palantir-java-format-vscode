package io.github.lucasfleury.palantirworker;

import com.palantir.javaformat.java.FormatterException;
import com.palantir.javaformat.java.FormatterService;
import java.util.ServiceLoader;

public final class PalantirFormatter {
    private final FormatterService formatterService;

    public PalantirFormatter() {
        this(ServiceLoader.load(FormatterService.class)
                .findFirst()
                .orElseThrow(() -> new IllegalStateException("Palantir FormatterService implementation not found.")));
    }

    PalantirFormatter(FormatterService formatterService) {
        this.formatterService = formatterService;
    }

    public String format(String source) throws FormatterException {
        return formatterService.formatSourceReflowStringsAndFixImports(source);
    }
}
