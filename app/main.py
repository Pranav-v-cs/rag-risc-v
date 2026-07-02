from ingestion import ingestion
from query import query

if __name__ == "__main__":
    ingestion()

    while True:
        user_input = input("👤 Ask a question: ")
        if user_input.lower() in ['exit', 'quit']:
            print("👋 Goodbye!")
            break
        if not user_input.strip():
            continue
            
        try:
            print("⏳ Searching database and thinking...")
            answer = query(user_input)
            print(f"\n🤖 Answer:\n{answer}\n")
            print("="*60 + "\n")
        except Exception as e:
            print(f"❌ Error executing chat loop: {e}\n")
