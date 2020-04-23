int main() {
    int sum[1000] = {1, 2, 3, 4};

    for (int i = 1; i < 1000; i++)
    {
        sum[0] += sum[i - 1];
    }
}
