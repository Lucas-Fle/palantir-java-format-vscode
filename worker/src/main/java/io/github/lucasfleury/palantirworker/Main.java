package io.github.lucasfleury.palantirworker;

import java.io.IOException;

public final class Main {
    private Main() {}

    public static void main(String[] args) {
        try {
            new ProtocolServer(System.in, System.out, System.err, new PalantirFormatter()).run();
        } catch (RuntimeException | IOException exception) {
            System.err.println("Worker terminated: " + exception.getMessage());
            System.exit(1);
        }
    }
}
